/**
 * 터미널 대화형 입력 리더.
 *
 * raw 모드에서 stdin을 **한 곳에서만** 읽는다. 프롬프트마다 readline 인터페이스를
 * 새로 열었다 닫으면, 앞 프롬프트의 readline이 뒤 프롬프트 몫의 입력까지
 * 버퍼에 삼켜서(붙여넣기 등) 다음 입력이 영영 오지 않는 문제가 생긴다.
 * 그래서 리스너 하나를 유지하고, 소비되지 않은 문자는 직접 보관했다가 다음 프롬프트에 넘긴다.
 *
 * 비밀번호 입력은 터미널 에코에 기대지 않고 직접 `*`만 출력하므로
 * 스크롤백이나 화면 공유에 평문이 남지 않는다.
 */
export class TerminalPrompt {
  /** 아직 어떤 프롬프트도 가져가지 않은 입력 */
  private pending = '';
  /** 현재 입력을 기다리는 프롬프트의 문자 처리기 */
  private active: ((char: string) => void) | undefined;
  /** Windows의 CRLF에서 '\r' 다음에 오는 '\n'을 빈 입력으로 오해하지 않기 위한 플래그 */
  private skipNextLineFeed = false;
  private ended = false;
  private onEnd: (() => void) | undefined;

  constructor(
    private readonly input: NodeJS.ReadStream = process.stdin,
    private readonly output: NodeJS.WriteStream = process.stdout,
  ) {
    this.input.setRawMode(true);
    this.input.resume();
    this.input.setEncoding('utf8');
    this.input.on('data', this.handleChunk);
    this.input.on('end', this.handleEnd);
  }

  /** 입력한 내용이 화면에 그대로 보이는 프롬프트 */
  question(text: string): Promise<string> {
    return this.read(text, false);
  }

  /** 입력한 내용이 `*`로만 보이는 프롬프트 */
  password(text: string): Promise<string> {
    return this.read(text, true);
  }

  close(): void {
    this.input.off('data', this.handleChunk);
    this.input.off('end', this.handleEnd);
    this.input.setRawMode(false);
    this.input.pause();
  }

  private read(text: string, mask: boolean): Promise<string> {
    // stdin이 이미 닫혔더라도 아직 넘겨주지 않은 입력이 남아 있으면 그것부터 쓴다.
    if (this.ended && !this.pending) {
      return Promise.reject(new Error('입력이 끝났습니다.'));
    }
    this.output.write(text);

    return new Promise<string>((resolve, reject) => {
      let value = '';
      let settled = false;

      const finish = (settle: () => void): void => {
        settled = true;
        this.active = undefined;
        this.onEnd = undefined;
        this.output.write('\n');
        settle();
      };

      this.onEnd = () => finish(() => reject(new Error('입력이 끝났습니다.')));

      this.active = (char: string): void => {
        switch (char) {
          case '\r':
          case '\n':
          case '': // Ctrl+D
            finish(() => resolve(value));
            return;
          case '': // Ctrl+C
            finish(() => reject(new Error('입력이 취소되었습니다.')));
            return;
          case '': // Backspace
          case '\b':
            if (value.length > 0) {
              value = value.slice(0, -1);
              this.output.write('\b \b');
            }
            return;
          default:
            // 제어문자(방향키 등)는 무시하고 출력 가능한 문자만 받는다
            if (char >= ' ') {
              value += char;
              this.output.write(mask ? '*' : char);
            }
        }
      };

      // 앞선 프롬프트가 쓰고 남긴 입력을 먼저 소진한다
      const buffered = this.pending;
      this.pending = '';
      this.consume(buffered);

      // 남은 입력을 다 써도 한 줄이 완성되지 않았고 stdin도 이미 닫혔다면 더 기다릴 게 없다
      if (!settled && this.ended) {
        finish(() => reject(new Error('입력이 끝났습니다.')));
      }
    });
  }

  private handleChunk = (chunk: string): void => {
    this.consume(chunk);
  };

  private handleEnd = (): void => {
    this.ended = true;
    this.onEnd?.();
  };

  private consume(chunk: string): void {
    for (const char of chunk) {
      if (this.skipNextLineFeed) {
        this.skipNextLineFeed = false;
        if (char === '\n') {
          continue;
        }
      }
      if (char === '\r') {
        this.skipNextLineFeed = true;
      }

      if (this.active) {
        this.active(char);
      } else {
        // 아직 아무도 기다리지 않는 입력은 보관했다가 다음 프롬프트에 넘긴다
        this.pending += char;
      }
    }
  }
}
