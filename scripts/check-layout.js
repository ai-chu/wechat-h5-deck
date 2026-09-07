/**
 * 一屏一页自检 —— 在浏览器控制台里粘贴运行（先把窗口调到 375×700）
 *
 * 为什么不用 scrollHeight：它会把绝对定位的装饰元素（比如画到容器外的光斑）
 * 也算进去，凭空多出几十像素，导致你压了半天压的是不存在的问题。
 * 封面还有一处坑 —— .inner 带 flex:1 会被撑满，量出来永远等于视口高。
 */
(() => {
  const deck = document.getElementById('deck');
  const screens = document.querySelectorAll('.screen');
  const vp = deck.clientHeight;
  const bgm = document.getElementById('bgm');
  const limit = bgm ? bgm.getBoundingClientRect().top : vp;
  const bad = [];

  console.log(`视口 ${vp}px　音符键顶部 ${Math.round(limit)}px`);
  screens.forEach((el, i) => {
    deck.scrollTop = el.offsetTop;
    const r = el.querySelector('.inner').getBoundingClientRect();
    const title = el.querySelector('h2');
    const name = title ? title.textContent.trim().slice(0, 10) : (el.id || '封面');
    const overflow = r.bottom > vp || r.top < 0;
    const covered = r.bottom > limit;
    if (overflow || covered) bad.push(i);
    console.log(
      `${String(i).padStart(2)} ${name.padEnd(12)} 余 ${String(Math.round(vp - r.bottom)).padStart(4)}` +
      (overflow ? '  ✗ 超出一屏' : covered ? '  ✗ 被音符键压住' : '  ✓')
    );
  });
  deck.scrollTop = 0;
  console.log(bad.length ? `\n需要压缩的屏：${bad.join(', ')}` : '\n全部通过');
})();
