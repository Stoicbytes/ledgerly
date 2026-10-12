import { deepStrictEqual, strictEqual } from "node:assert";
import {
  chunk,
  DEFAULT_ORIGINS,
  indiaToday,
  minusDays,
  originAllowed,
  parseAmfi,
  parseBhavcopy,
  parseMfapiHistory,
  recentWeekdays,
  safeEqual,
  splitCsvLine,
  toIsoDate,
} from "./parse.ts";

// The layout of AMFI's NAVAll.txt (fund names are fictional).
const AMFI = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
  "",
  "Open Ended Schemes(Equity Scheme - Large Cap Fund)",
  "",
  "Horizon Mutual Fund",
  "",
  "120465;INF846K01DP8;-;Horizon Bluechip Fund - Direct Plan - Growth;58.1200;07-Oct-2026",
  "120466;INF846K01DQ6;INF846K01DR4;Horizon Bluechip Fund - Direct Plan - IDCW;21.4567;07-Oct-2026",
  "",
  "Meridian Mutual Fund",
  "",
  "130001;-;-;Meridian  Large Cap  Fund - Regular - Growth;N.A.;07-Oct-2026",
  "",
  "Interval Fund Schemes(Income)",
  "",
  "Summit Mutual Fund",
  "140001;INF000000017;;Summit Interval Fund - Growth;1,012.3456;06-Oct-2026",
  "120465;INF846K01DP8;-;Duplicate row is ignored;1;07-Oct-2026",
  "garbage;line",
].join("\r\n");

Deno.test("parseAmfi reads schemes with their category and fund house", () => {
  const { rows, latestDate } = parseAmfi(AMFI);
  strictEqual(rows.length, 4);
  strictEqual(latestDate, "2026-10-07");
  deepStrictEqual(rows[0], {
    scheme_code: 120465,
    name: "Horizon Bluechip Fund - Direct Plan - Growth",
    fund_house: "Horizon Mutual Fund",
    category: "Equity Scheme - Large Cap Fund",
    isin_growth: "INF846K01DP8",
    isin_reinvest: null,
    nav: 58.12,
    nav_date: "2026-10-07",
  });
  strictEqual(rows[1].isin_reinvest, "INF846K01DR4");
  // N.A. → no NAV (and no date); spaces collapsed.
  strictEqual(rows[2].nav, null);
  strictEqual(rows[2].nav_date, null);
  strictEqual(rows[2].name, "Meridian Large Cap Fund - Regular - Growth");
  strictEqual(rows[2].fund_house, "Meridian Mutual Fund");
  strictEqual(rows[3].category, "Income");
  strictEqual(rows[3].nav, 1012.3456);
  strictEqual(rows[3].fund_house, "Summit Mutual Fund");
});

// The layout since 2026: Plan and Option columns before the NAV (fund names are fictional).
const AMFI_WITH_PLAN = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  " ",
  "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)",
  " ",
  "Horizon Mutual Fund",
  " ",
  "129008;INF090I01KR8;-;Horizon Banking & PSU Debt Fund;Direct Plan;Growth;25.3336;12-Oct-2026",
  "129009;INF090I01KS6;INF090I01KT4;Horizon Banking & PSU Debt Fund;Direct Plan;IDCW;11.4637;12-Oct-2026",
  "123689;INF174K01KI5;INF174K01KJ3;Horizon Banking & PSU Debt Fund;Direct Plan;Annual Dividend;17.1427;15-Sep-2017",
  "130947;INF109KA1I84;-;Horizon Corporate Bond Fund;;;N.A.;12-Oct-2026",
].join("\r\n");

Deno.test("parseAmfi reads the layout with Plan and Option columns", () => {
  const { rows, latestDate } = parseAmfi(AMFI_WITH_PLAN);
  strictEqual(rows.length, 4);
  strictEqual(latestDate, "2026-10-12");
  deepStrictEqual(rows[0], {
    scheme_code: 129008,
    name: "Horizon Banking & PSU Debt Fund - Direct Plan - Growth",
    fund_house: "Horizon Mutual Fund",
    category: "Debt Scheme - Banking and PSU Fund",
    isin_growth: "INF090I01KR8",
    isin_reinvest: null,
    nav: 25.3336,
    nav_date: "2026-10-12",
  });
  strictEqual(rows[1].isin_reinvest, "INF090I01KT4");
  strictEqual(rows[1].nav, 11.4637);
  // A scheme that stopped publishing keeps its own (old) date.
  strictEqual(rows[2].nav_date, "2017-09-15");
  // Empty Plan and Option are left out of the name; N.A. → no NAV.
  strictEqual(rows[3].name, "Horizon Corporate Bond Fund");
  strictEqual(rows[3].nav, null);
});

Deno.test("parseAmfi returns nothing for an unrelated file", () => {
  deepStrictEqual(parseAmfi("<html>blocked</html>"), { rows: [], latestDate: null });
});

// The UDiFF CM bhavcopy layout (since July 2024); values are made up.
const UDIFF = [
  "TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd1,Rsvd2,Rsvd3,Rsvd4",
  "2026-10-07,2026-10-07,CM,NSE,STK,2885,INE002A01018,RELIANCE,EQ,,,,,RELIANCE INDUSTRIES LTD,2900.00,2960.00,2890.00,2950.50,2951.00,2900.00,,2950.50,,,100,1000,10,F1,1,,,,,",
  '2026-10-07,2026-10-07,CM,NSE,STK,11536,INE467B01029,TCS,EQ,,,,,"TATA CONSULTANCY SERVICES, LTD",4100,4150,4080,4120.05,4121,4100.00,,4120.05,,,1,1,1,F1,1,,,,,',
  "2026-10-07,2026-10-07,CM,NSE,STK,1,INE000A01015,SOMEBOND,N1,,,,,SOME BOND,100,100,100,100,100,100,,100,,,1,1,1,F1,1,,,,,",
  "2026-10-07,2026-10-07,CM,NSE,STK,2,INE774D01024,M&M,EQ,,,,,MAHINDRA & MAHINDRA LTD,3000,3000,3000,3010.10,3010,,,3010,,,1,1,1,F1,1,,,,,",
  "2026-10-07,2026-10-07,CM,NSE,STK,3,BADISIN,BAD,EQ,,,,,BAD,1,1,1,1,1,1,,1,,,1,1,1,F1,1,,,,,",
].join("\n");

Deno.test("parseBhavcopy keeps equity shares in paise", () => {
  const { rows, tradeDate } = parseBhavcopy(UDIFF, "NSE");
  strictEqual(tradeDate, "2026-10-07");
  deepStrictEqual(rows.map((row) => row.symbol), ["RELIANCE", "TCS", "M&M"]);
  deepStrictEqual(rows[0], {
    isin: "INE002A01018",
    symbol: "RELIANCE",
    name: "RELIANCE INDUSTRIES LTD",
    series: "EQ",
    close: 295050,
    prev_close: 290000,
  });
  strictEqual(rows[1].name, "TATA CONSULTANCY SERVICES, LTD");
  strictEqual(rows[1].close, 412005);
  strictEqual(rows[2].prev_close, null);
});

Deno.test("parseBhavcopy finds the older column names too", () => {
  const legacy = [
    "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN",
    "INFY,EQ,1500,1510,1490,1505.25,1505,1499.9,10,10,07-OCT-2026,5,INE009A01021",
  ].join("\n");
  const { rows, tradeDate } = parseBhavcopy(legacy, "NSE");
  strictEqual(tradeDate, "2026-10-07");
  deepStrictEqual(rows[0], {
    isin: "INE009A01021",
    symbol: "INFY",
    name: "",
    series: "EQ",
    close: 150525,
    prev_close: 149990,
  });
});

Deno.test("parseBhavcopy keeps every BSE group and rejects files without the columns", () => {
  const bse = UDIFF.replace(",EQ,,,,,RELIANCE", ",A,,,,,RELIANCE").replaceAll(",NSE,", ",BSE,");
  strictEqual(parseBhavcopy(bse, "BSE").rows[0].series, "A");
  strictEqual(parseBhavcopy(bse, "NSE").rows.length, 2);
  deepStrictEqual(parseBhavcopy("a,b\n1,2", "NSE"), { rows: [], tradeDate: null });
});

Deno.test("parseMfapiHistory sorts and filters points", () => {
  const body = {
    meta: { scheme_code: 120465 },
    data: [
      { date: "07-10-2026", nav: "58.12000" },
      { date: "06-10-2026", nav: "57.90010" },
      { date: "01-01-2020", nav: "20.00000" },
      { date: "bad", nav: "1" },
      { date: "05-10-2026", nav: "0" },
    ],
  };
  deepStrictEqual(parseMfapiHistory(body, "2026-01-01"), [
    ["2026-10-06", 57.9001],
    ["2026-10-07", 58.12],
  ]);
  deepStrictEqual(parseMfapiHistory({ status: "FAIL" }, null), []);
});

Deno.test("date helpers", () => {
  strictEqual(toIsoDate("07-Oct-2026"), "2026-10-07");
  strictEqual(toIsoDate("31-Feb-2026"), null);
  strictEqual(toIsoDate("2026-10-07"), "2026-10-07");
  strictEqual(toIsoDate("7-10-2026"), "2026-10-07");
  // 20:00 UTC is already the next day in India.
  strictEqual(indiaToday(new Date("2026-10-07T20:00:00Z")), "2026-10-08");
  // Friday 9 Oct back over the weekend.
  deepStrictEqual(recentWeekdays("2026-10-12", 3), ["2026-10-12", "2026-10-09", "2026-10-08"]);
  strictEqual(minusDays("2026-03-01", 1), "2026-02-28");
});

Deno.test("small helpers", () => {
  deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  deepStrictEqual(splitCsvLine('a,"b,""c""",d'), ["a", 'b,"c"', "d"]);
  strictEqual(safeEqual("secret-value", "secret-value"), true);
  strictEqual(safeEqual("secret-value", "secret-valuX"), false);
  strictEqual(safeEqual("short", "longer-value"), false);
});

Deno.test("allows listed origins and the project's preview deployments only", () => {
  const list = [
    "https://app.example",
    "https://ledgerly-*-studio.vercel.app",
  ];
  strictEqual(originAllowed("https://app.example", list), true);
  strictEqual(
    originAllowed("https://ledgerly-zmkzjqvnc-studio.vercel.app", list),
    true,
  );
  strictEqual(originAllowed("https://evil.example", list), false);
  strictEqual(
    originAllowed("https://ledgerly-x.evil-studio.vercel.app", list),
    false,
  );
  strictEqual(
    originAllowed("https://ledgerly--studio.vercel.app", list),
    false,
  );
  strictEqual(originAllowed("https://app.example.evil", list), false);
});

Deno.test("the default origins admit the project's deployments only", () => {
  for (
    const origin of [
      "https://ledgerly.vercel.app",
      "https://ledgerly-stoicbytes-developers-team.vercel.app",
      "https://ledgerly-cr37bj64v-stoicbytes-developers-team.vercel.app",
      "http://localhost:8081",
    ]
  ) strictEqual(originAllowed(origin, DEFAULT_ORIGINS), true, origin);
  for (
    const origin of [
      "https://evil-stoicbytes-developers-team.vercel.app",
      "https://ledgerly-x.evil-stoicbytes-developers-team.vercel.app",
      "https://other-cr37bj64v-stoicbytes-developers-team.vercel.app",
      "https://ledgerly.vercel.app.evil",
    ]
  ) strictEqual(originAllowed(origin, DEFAULT_ORIGINS), false, origin);
});
