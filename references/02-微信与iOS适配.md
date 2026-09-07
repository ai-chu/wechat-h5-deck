# 微信与 iOS 适配：踩过的坑

这一篇是本技能最值钱的部分。下面每一条都是实际做项目时栽过、
排查过、最后确认了原因的问题 —— 通用的落地页教程里一条都不会讲。

---

## 一、背景音乐

### 微信里可以自动播放，普通浏览器不行

浏览器一律禁止无用户手势的自动播放，但**微信内核开了一个口子**：
通过 `WeixinJSBridge` 可以在无手势的情况下起声。

```js
// 微信：桥就绪后可无手势起声。
// 首次打开时桥常常还没注入好，事件与轮询两条路都要留 ——
// 只监听事件会漏掉「脚本执行时桥已就绪」的情况，那时事件早就触发过了。
if (window.WeixinJSBridge && window.WeixinJSBridge.invoke) {
  WeixinJSBridge.invoke('getNetworkType', {}, autoStart);
} else {
  document.addEventListener('WeixinJSBridgeReady', function () {
    WeixinJSBridge.invoke('getNetworkType', {}, autoStart);
  }, false);
  var n = 0, iv = setInterval(function () {
    if (window.WeixinJSBridge && window.WeixinJSBridge.invoke) {
      clearInterval(iv);
      WeixinJSBridge.invoke('getNetworkType', {}, autoStart);
    } else if (++n > 50) clearInterval(iv);   // 最多等 5 秒
  }, 100);
}
```

非微信环境退回「首次触摸／点击／滚动时起声」，用户滑第一下就会响。

### ⚠️ 不要用 Web Audio 合成音乐

曾经用 Web Audio API 实时合成过背景音（零文件加载，听起来很美好），
结果在 **iOS 18 及更早的机型上整个哑掉**：

> `AudioContext` 一旦在**没有用户手势**的时候被创建，就会被系统永久锁死，
> 之后连点按钮触发的 `resume()` 都救不回来。

更麻烦的是这个失效是**静默的** —— 不报错、`readyState` 正常、代码逻辑看着完全对。
新机型上一切正常，老机型上全哑，极难排查。

**结论：老老实实用 `<audio>` 元素放 mp3 文件。** 它的播放支持从很老的版本
起就是稳的，新老机型走同一条路。

### 默认出声就要告诉人怎么关

页面一打开就放音乐，用户可能正在开会、在地铁上。起声后弹一次轻提示
「轻触右下角可关闭音乐」，并把音量压到 0.3 左右。手动关掉后不再自动重启。

---

## 二、iPhone 的底部安全区

**这是最容易漏、又一定会被发现的问题。**

iPhone 底部的 home indicator（那道横条）会占掉约 34px。如果页面底部有固定的
操作条，它的实际高度是 `你设的高度 + env(safe-area-inset-bottom)`，
而内容区的 `padding-bottom` 如果只算了前半段，底部内容就会被压住。

```css
/* 有底部操作条时 */
padding-bottom: calc(var(--bar) + env(safe-area-inset-bottom) + 18px);

/* 没有操作条、但右下角有悬浮按钮时 */
padding-bottom: calc(env(safe-area-inset-bottom) + 52px);
/*                     52 = 按钮高 34 + 下边距 14 + 余隙 */
```

**悬浮按钮同理**：`position: fixed` 的元素会浮在正文上。原先有操作条垫着看不出来，
一旦删掉操作条，按钮就直接压到文字上了。给内容留出按钮的高度。

---

## 三、翻页手感

要做到「一次滑动只翻一页」，两个属性缺一不可：

```css
#deck  { scroll-snap-type: y mandatory; }
.screen{ scroll-snap-align: start; scroll-snap-stop: always; }
```

- `mandatory` —— 滚动停下必定对齐到某一屏，不会悬在两屏之间
- `scroll-snap-stop: always` —— **关键**。它规定滚动容器不得越过这个吸附点，
  也就是一次滑动手势最多翻一页，手指甩得再重也只走一屏

只用 `proximity` 的话，它仅在滚动**停下的位置恰好靠近**吸附点时才对齐；
手一甩带出惯性，停下时早已越过好几屏，于是完全不吸附。

兼容性：`scroll-snap-stop` 在 iOS Safari 15+ 和安卓 X5（Chrome 86+ 内核）都支持，
微信环境全覆盖。老内核不认这条属性时退化成普通吸附，仍然可用。

内容高过一屏的那些屏不会被卡住 —— 规范规定吸附区大于视口时允许自由滚动，
主流浏览器都正确实现了。

---

## 四、一屏一页：怎么量才准

**别用 `scrollHeight` 测屏高。** 它会把绝对定位的装饰元素也算进去 ——
比如一个故意画到容器外的背景光斑，能让测量值凭空多出二三十像素，
你会对着不存在的问题反复压缩。

**封面还有一处坑**：如果 `.inner` 带了 `flex: 1`，它会被撑满可用空间，
量出来永远等于视口高度，测不出真实内容高度。要把子元素的高度逐个加起来，
并扣掉 `margin: auto` 分配的空白。

正确的量法见 `scripts/check-layout.js`。

设计基准：**每屏内容不超过 660px**。主流 iPhone 在微信里的可视高度约 745–790px，
留出余量给小屏机型。日程超过 7 讲就要拆屏。

---

## 五、删元素必须同时删 JS

```js
var qi = document.getElementById('qrimg');   // 元素已随那一屏被删 → null
qi.addEventListener('error', fallback);      // ← TypeError，脚本从这里整个中断
```

后果：**这一行之后的所有代码静默失效**。曾经因此让背景音乐和复制按钮同时失灵，
而语法检查完全通过 —— 因为语法没错，是运行时才炸。

删掉任何 HTML 之后，跑一遍这个对照：

```js
const html = document.documentElement.outerHTML;
[...new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))]
  .forEach(id => { if (!document.getElementById(id)) console.warn('缺失元素:', id); });
```

---

## 六、字体

中文字体动辄 5–10MB，直接引全量会让首屏等很久。

- **用 Google Fonts 的分片版本**（带 `unicode-range`），浏览器只下用到的那几片
- 国内网络下 Google Fonts 可能被拦，**正式上线前把字体文件下到自己服务器**，
  改成本地引用，并给字体设一年的 `immutable` 缓存
- 标题字可以转成 SVG 路径，彻底不依赖字体加载
- 无论如何都要写完整的 fallback 字体栈，加载失败时排版不能塌

---

## 七、转发卡片

微信里转发链接会生成一张卡片。想让它显示标题和缩略图：

```html
<meta property="og:title" content="…">
<meta property="og:description" content="…">
<meta property="og:image" content="https://你的域名/share.png">
<link rel="image_src" href="https://你的域名/share.png">
```

这一层零成本，微信**通常**能抓到。

**要精确控制卡片就得上微信 JS-SDK**，那需要认证的公众号 + 配置 JS 安全域名 +
后端签名接口，每次加载都要请求签名。为一次活动上这套不划算。

何况主传播路径是**海报图片本身** —— 海报在聊天里就是一张完整的图，
信息比任何卡片都全。卡片只在别人二次转发链接时才出现。

---

## 八、位图二维码的配色

微信群二维码是位图，改不了前景色，白底方块放在纸感页面上会很突兀。
不用改图，一行 CSS 就能让它「印」在纸上：

```css
.qr img { mix-blend-mode: multiply; }
```

正片叠底：白色区域乘以底色等于底色（融进纸面），黑色保持黑色（对比度不受影响，
照样能扫）。老内核不支持时退回白底，仍然可用：

```css
@supports not (mix-blend-mode: multiply) {
  .qr { background: #FCFAF5; }
}
```

自己生成的二维码（比如指向详情页的那个）就没这个问题，
用 `qrcode.js` 时直接指定 `colorDark` / `colorLight` 即可。
