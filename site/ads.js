// Loads Google AdSense into the page's ad spaces, only when ads-config.js is
// filled in. Each space is labeled "Advertisement" and sits outside the trial
// results, so ads are never mistaken for studies.
(function () {
  const cfg = window.PV_ADS || {};
  const client = (cfg.adsenseClient || '').trim();
  if (!/^ca-pub-\d{10,}$/.test(client)) return; // not set up yet: spaces stay hidden

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);

  document.querySelectorAll('.pv-ad[data-ad]').forEach((box) => {
    const slot = ((cfg.slots || {})[box.dataset.ad] || '').trim();
    if (!/^\d+$/.test(slot)) return;
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    box.querySelector('.pv-ad-body').appendChild(ins);
    box.hidden = false;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
})();
