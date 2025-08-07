import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// __filename, __dirname을 ESM에서 사용할 수 있게 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 트위터 계정의 모든 트윗을 삭제하는 스크립트입니다.
 *
 * 사용법:
 * 1. puppeteer와 관련 패키지를 설치합니다.
 * 2. 이 스크립트를 실행합니다. (npm start 또는 ts-node delete.ts)
 * 3. 브라우저가 열리면 로그인 후 트윗 삭제가 자동으로 진행됩니다.
 */
// 주의: 이 스크립트는 트위터의 정책에 위배될 수 있으니, 사용 전에 반드시 트위터의 정책을 확인하세요.
// 또한, 너무 많은 트윗을 한 번에 삭제하면 계정이 일시 정지될 수 있습니다.
// 이 스크립트는 개인적인 용도로만 사용해야 하며, 타인의 계정이나 데이터를 삭제하는 데 사용해서는 안 됩니다.
// 이 스크립트는 트위터의 정책에 따라 언제든지 작동하지 않을 수 있습니다.
// 트위터의 UI 변경에 따라 스크립트가 작동하지 않을 수 있으며, 이 경우 코드를 수정해야 할 수 있습니다.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const userDataDir = path.resolve(__dirname, "chrome-profile"); // 로그인 정보 저장될 디렉토리

  try {
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir, // ⭐ 기존 로그인 상태 저장
      args: ["--start-maximized"],
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // 로컬 설치 Chrome 경로
    });

    const page = await browser.newPage();
    await page.goto("https://x.com/seo__248", {
      waitUntil: "networkidle2",
    });

    // 로그인 여부 확인 함수
    const isLoggedIn = async (): Promise<boolean> => {
      const loginCheck = await page.$$('a[href="/login"], a[href="/i/flow/login"], a[href="/i/flow/signup"]');
      const currentURL = page.url();

      const isOnLoginPage =
        currentURL.includes("/login") || currentURL.includes("/i/flow/login") || currentURL.includes("/i/flow/signup");

      if (isOnLoginPage) {
        // 현재 페이지가 로그인 페이지인 경우
        console.log("🔐 현재 로그인 페이지입니다. 로그인 상태 확인 중...");
        return false;
      }

      if (loginCheck.length > 0) {
        // 로그인 페이지에 있거나 로그인 관련 링크가 있으면 로그인 안 된 상태
        console.log("🔐 로그인되지 않았습니다. 로그인 페이지로 이동합니다...");
        await page.goto("https://x.com/login", { waitUntil: "networkidle2" });
        return false;
      }

      return true;
    };

    // 로그인 대기 루프
    while (true) {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        console.log("✅ 로그인 완료됨. 삭제 시작합니다.");
        break;
      }
      console.log("🔐 로그인되지 않음. 10초 후 다시 확인합니다...");
      await wait(10000);
    }

    await page.waitForSelector("article", { timeout: 10000 });

    // 삭제 루프
    while (true) {
      const tweets = await page.$$("article");

      if (tweets.length === 0) {
        console.log("✅ 더 이상 삭제할 트윗이 없습니다.");
        break;
      }

      for (const tweet of tweets) {
        try {
          const menuBtn = await tweet.$('button[aria-label="더 보기"][data-testid="caret"]');
          if (!menuBtn) {
            console.log("⚠️ 더 보기 버튼 없음");
            continue;
          }

          await menuBtn.click();
          await wait(500);

          const menuItems = await page.$$('[role="menuitem"]');

          let deleted = 0;

          for (const item of menuItems) {
            const text = await item.evaluate((el) => (el as any).innerText.trim());

            if (text === "삭제하기") {
              console.log("🗑️ 삭제 버튼 클릭!");
              await item.click();

              // 1차 삭제 확인 (기존)
              await page.waitForSelector('button[data-testid="confirmationSheetConfirm"]', { timeout: 5000 });
              // 직접 버튼을 찾아서 텍스트 읽기
              const confirmButtons = await page.$$('button[data-testid="confirmationSheetConfirm"]');

              let clicked = false;
              for (const btn of confirmButtons) {
                const text = await btn.evaluate((el) => el.textContent?.trim());
                if (text === "삭제하기" || text === "삭제") {
                  await btn.click();
                  console.log("🟥 1차 삭제 확인 버튼 클릭됨");
                  await wait(1000);
                  clicked = true;
                  break;
                }
              }

              // 혹시 다시 한 번 팝업이 뜬 경우 → 추가 삭제 확인
              if (clicked) {
                try {
                  await page.waitForSelector('button[data-testid="confirmationSheetConfirm"]', { timeout: 2000 });
                  const secondConfirm = await page.$('button[data-testid="confirmationSheetConfirm"]');
                  if (secondConfirm) {
                    await secondConfirm.click();
                    console.log("🟥 2차 삭제 확인 버튼 클릭됨");
                    await wait(1000);
                  }
                } catch {
                  // 2차 버튼 없으면 무시
                }
              }

              break;
            }
          }

          if (!deleted) {
            console.log("❌ 삭제 버튼을 찾지 못했습니다");
          }
        } catch (e) {
          console.warn("⚠️ 삭제 중 오류 발생", e);
        }
      }

      // 스크롤하여 다음 트윗 로딩
      await page.evaluate(() => {
        // @ts-ignore
        window.scrollBy(0, window.innerHeight);
      });
      await wait(2000);
    }

    console.log("🎉 전체 트윗 삭제 완료!");
    // await browser.close();
  } catch (e) {
    console.error("❌ 실행 중 오류 발생:", e);
  }
})();
