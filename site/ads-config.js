// Ad settings. Ads stay switched off (and their spaces hidden) until
// adsenseClient is filled in.
//
// To turn on Google AdSense once your account is approved:
//   1. adsenseClient: your publisher ID from AdSense, like "ca-pub-1234567890123456"
//   2. slots: the "data-ad-slot" number of each display ad unit you create in AdSense
//      (Ads → By ad unit → Display ads). Leave a slot empty to keep that space hidden.
//
// Where each slot appears on the page:
//   top    — under the search box at the top
//   mid    — after the trial tabs, before "Found a trial? Get ready…"
//   bottom — above the footer
// Ads never appear inside trial search results or trial lists.
window.PV_ADS = {
  adsenseClient: '',
  slots: {
    top: '',
    mid: '',
    bottom: '',
  },
};
