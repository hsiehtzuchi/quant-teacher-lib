# quant-teacher-lib

講量化算式用的小函式庫：算數字、用 KaTeX 排公式、畫一步一步的互動圖。一支 teacher.js 加一支 teacher.css，不用打包工具。

## 載入

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/hsiehtzuchi/quant-teacher-lib@v0.1.0/teacher.css">
<script src="https://cdn.jsdelivr.net/gh/hsiehtzuchi/quant-teacher-lib@v0.1.0/teacher.js"></script>
```

teacher.js 會自己從 jsdelivr 載 KaTeX 0.19.1，版本和完整性雜湊都寫死。載好之前公式先顯示原文，載好自動換成排好的式子；`Teacher.ready` 是載好時完成的 Promise。載不到時留原文，圖照樣能用。

在 node 裡 `require('./teacher.js')` 拿到同一個物件，可以只用數字函式。

## 最小例子

```html
<div id="demo"></div>
<script>
  Teacher.steps('#demo', {
    names: ['甲', '乙', '丙', '丁', '戊'],
    segments: [{
      title: '排名再倒過來',
      full: ['1-\\operatorname{rank}(x)'],
      steps: [
        { tex: 'x', values: [3, 1, 4, 1.5, 5], text: '五支的原始數字，舉例。' },
        { tex: '\\operatorname{rank}(x)', op: 'rank', text: '互相比，最小 0、最大 1。' },
        { tex: '1-\\operatorname{rank}(x)', op: 'oneMinus', flip: true, text: '用 1 去減，名次倒過來。' },
        { tex: '\\text{減平均}', op: 'neutralize', text: '正的買、負的放空，離 0 越遠錢越多。' }
      ]
    }]
  });
</script>
```

## 數字函式

陣列裡的 null、undefined、NaN、Infinity 都當沒有數字：輸出 NaN，也不算進家數。時間序列的陣列由舊到新排，d 是天數；前面不滿 d 天，或窗內有沒數字的天，那天輸出 NaN。

| 函式 | 參數 | 回傳 |
|---|---|---|
| `rank(xs)` | xs 同一天各股票的值 | 最小 0、最大 1，中間平均分；同分取名次平均；只有一家得 0.5 |
| `scale(xs, s=1)` | s 絕對值總和的目標 | 除以絕對值的和再乘 s；全部是 0 時回全部 0 |
| `neutralize(xs, groups)` | groups 每支的組別，可省略 | 減平均；給 groups 就減同組平均 |
| `tsMean(xs, d)` | d 天數 | 過去 d 天平均 |
| `tsStdDev(xs, d)` | d 天數 | 過去 d 天標準差，除以 d |
| `decayLinear(xs, d)` | d 天數 | 今天乘 d、昨天乘 d−1 到乘 1，除以 1 加到 d |
| `tsRank(xs, d, c=0)` | d 天數，c 加在結果上的常數 | 今天在 d 天裡從 0 數起的名次除以 d−1，同分取平均 |
| `corr(xs, ys, d)` | 兩條等長序列 | 過去 d 天的相關；一邊 d 天都一樣時回 NaN |
| `argMin(xs, d)` | d 天數 | 最小那天距今幾天，今天是 0；同樣最小取最近 |
| `fmt(v)` | 一個數字 | 四捨五入到三位的字串，負號用數學減號，沒有數字寫明 |

`Teacher.ops` 是步驟圖能用的運算：rank、scale、neutralize、neg 乘 −1、oneMinus 用 1 去減、rsub 用常數去減、add、sub、mul、div、min。後面六個的第二個參數可以是一個數字，也可以是等長陣列。任何一邊沒數字、或算出來不是有限數字，像除以 0，結果就是沒數字，不會變成 0。

`run(steps)` 照步驟算出每一步的值；`chain(xs, ops)` 照順序套運算，ops 寫成 `['rank', ['mul', 2]]`。

## 畫圖函式

每個畫圖函式的 el 可以是元素，也可以是選擇器字串。

`k(tex, display)`：把 TeX 排成 HTML 字串，display 為真時排成獨立一行。

`cards(el, list)`：一個策略一張卡，由上往下是標題、在賭什麼、總式、零件和運算子、代入例子、經濟意涵、弱點。每張卡：

| 欄位 | 內容 |
|---|---|
| title、bet | 標題、一句在賭什麼 |
| formula | 總式的 TeX |
| parts | `[{name, tex, text}]`，定義式在左、白話在右，手機上下排 |
| subs | 代入例子，格式同 parts |
| meaning、weakness | 經濟意涵、弱點 |

`steps(el, {names, segments})`：一步一步的互動圖，上面分段按鈕，下面上一步、下一步。每段：

| 欄位 | 內容 |
|---|---|
| title | 分段按鈕上的字 |
| full | 完整原式，一行一個 TeX 字串 |
| dim | `[{tex, why}]`，原式裡沒作用的部分標灰，why 寫為什麼 |
| parts | 分開的零件定義，格式同 cards 的 parts |
| steps | 每步 `{tex, text, values 或 op, arg, from, hl, flip}` |

步驟欄位：values 直接給值，算新的起頭；op 是 `Teacher.ops` 的名字，預設拿上一步當輸入，from 指定第幾步，從 0 數起；arg 是第二個參數，寫成 `{step: i}` 就用第 i 步的值；hl 是原式裡要標橘色的那段 TeX，要和 full 裡的字一模一樣；flip 為真時加翻號標籤，並在每條橫條旁寫由正變負、由負變正或名次怎麼變。灰色細線是輸入那一步的值。

`candles(el, list)`：K 線每根縮成一樣高，橘線標收盤。每根 `{name, o, h, l, c, note}`。

`slider(el, o)`：拉動一支股票的值，比較兩種做法。o 是 `{names, values, index, min, max, step, left: {title, ops}, right: {title, ops}}`，index 是要拉的那支，ops 格式同 chain。

## 顏色

teacher.css 的顏色全是 `.tl` 上的變數，深色模式自動換一組。要改色就覆寫變數，例如 `.tl { --tl-pos: #0a0; }`。

## 授權

MIT。
