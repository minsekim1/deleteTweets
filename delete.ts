import puppeteer from "puppeteer";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
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
      return loginCheck.length === 0;
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

    let deleted = 0;

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
              await page.waitForSelector('div[role="dialog"]');
              const confirmItems = await page.$$('div[role="dialog"] div[role="button"] span');

              for (const confirm of confirmItems) {
                const confirmText = await confirm.evaluate((el) => (el as any).innerText.trim());
                if (confirmText === "삭제") {
                  await confirm.click();
                  await wait(500);

                  // ✅ 2차 팝업 존재 시 추가 클릭
                  const confirmFinal = await page.$('button[data-testid="confirmationSheetConfirm"]');
                  if (confirmFinal) {
                    await confirmFinal.click();
                    await wait(500);
                  }

                  console.log(`🗑️ ${++deleted}번째 트윗 삭제 완료`);
                  await wait(1000);
                  deleted++;
                  break;
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
    await browser.close();
  } catch (e) {
    console.error("❌ 실행 중 오류 발생:", e);
  }
})();
