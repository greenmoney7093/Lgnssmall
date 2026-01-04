const axios = require("axios");
const { ethers } = require("ethers");
const BOT_TOKEN = "8451188468:AAHR3ntYIF9-Q0iGzBVubkJbPm48VAdmqtA"
const CHAT_ID = "1003118263"
/* ================= CONFIG ================= */

const LGNS  = "0xeb51d9a39ad5eef215dc0bf39a8821ff804a0f01";
const SLGNS = "0x99a57e6c8558bc6689f894e068733adf83c19725";
const DAI   = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";

const AMOUNT_IN = 14; // 1 LGNS
const THRESHOLD = 1.002;
const SLIPPAGE_PERCENT = 1;

const RPC = "https://polygon-rpc.com";
const provider = new ethers.JsonRpcProvider(RPC);

/* ========================================== */

async function quoteOpenOcean(tokenIn, tokenOut, amountIn) {
  try {
    const gasData = await provider.getFeeData();
    const currentGasPrice =
      gasData.gasPrice || ethers.parseUnits("30", "gwei");

    const res = await axios.get(
      "https://open-api.openocean.finance/v3/137/quote",
      {
        params: {
          inTokenAddress: tokenIn,
          outTokenAddress: tokenOut,
          amount: amountIn.toString(), // HUMAN amount (IMPORTANT)
          slippage: SLIPPAGE_PERCENT,
          gasPrice: ethers.formatUnits(currentGasPrice, "gwei")
        },
        timeout: 10000
      }
    );

    if (!res.data || !res.data.data || !res.data.data.outAmount) {
      throw new Error("Invalid OpenOcean response");
}

    return {
      outAmount: res.data.data.outAmount,
      dexes: res.data.data.dexes || [],
      estimatedGas: Number(res.data.data.estimatedGas || 0)
    };

  } catch (e) {
    console.log("Quote failed:", e.message);
    return null;
  }
}

/* ================= MAIN ================= */
async function notifyTelegram(message) {
  try {
    await axios.get(
      "https://api.telegram.org/bot8451188468:AAHR3ntYIF9-Q0iGzBVubkJbPm48VAdmqtA/sendMessage?chat_id=-1003512755878",
      {
        params: {
          text: message,
        }
      }
    );
    console.log("Telegram", )
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
}
async function checkOnce() {
  console.log("====== LGNS → DAI → sLGNS MONITOR ======");
  console.log(new Date().toLocaleString());
  console.log("--------------------------------------");

  /* ---------- LGNS → DAI (QuickSwapV3 only) ---------- */

  const daiQuote = await quoteOpenOcean(LGNS, DAI, AMOUNT_IN);
  if (!daiQuote) return;

  let qsV3SwapRaw = null;

for (const d of daiQuote.dexes) {
    if (d.dexCode === "QuickSwapV3") {
      qsV3SwapRaw = d.swapAmount;
    }
  }

  if (!qsV3SwapRaw) {
    console.log("❌ QuickSwapV3 not returned in LGNS → DAI");
    return;
  }

  const daiFromQSv3 = ethers.formatUnits(qsV3SwapRaw, 18);

  /* ---------- DAI → sLGNS (OpenOcean normal) ---------- */

  const slgnsQuote = await quoteOpenOcean(DAI, SLGNS, daiFromQSv3);
  if (!slgnsQuote) return;

  const slgnsFinal = ethers.formatUnits(slgnsQuote.outAmount, 9);
  const finalRatio = Number(slgnsFinal) / AMOUNT_IN;
  const totalGas = daiQuote.estimatedGas + slgnsQuote.estimatedGas;

  /* ---------- DISPLAY ---------- */

  console.log("Initial LGNS :", "14.000000");
  console.log("DAI received :", daiFromQSv3);
  console.log("sLGNS final  :", slgnsFinal);
  console.log("--------------------------------------");
  console.log("Final ratio  :", finalRatio.toFixed(6));
  console.log("Threshold    :", THRESHOLD);
  console.log("Estimated gas:", totalGas, "units");
  console.log("--------------------------------------");

  if (finalRatio >= THRESHOLD) {
    console.log(">>> OPPORTUNITY FOUND <<<");

    const msg =
      `small trade of 14 token fast $$$$$$$$$$          final sLGNS: ${slgnsFinal}`;
    await notifyTelegram(msg);
  } else {
    console.log("No opportunity");
    

  }
}

/* ================= LOOP ================= */

setInterval(checkOnce, 7000);
