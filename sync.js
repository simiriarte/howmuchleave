// Sync between devices with an "ocean code".
// The app still keeps everything in this browser (so it works offline and loads
// instantly); when an ocean code is set, every save is also sent to a tiny private
// store on AWS, and opening the app pulls the newest copy. Newest save wins.

(function () {
  const URL_ = "https://fpq4hdhhuryjwjyv5r3unn6d3y0gcymp.lambda-url.us-east-1.on.aws/";
  const POND_KEY = "howmuchleave.pond";
  const $ = (id) => document.getElementById(id);

  // Sea words for codes like coral-tuna-lantern-kelp-42
  const WORDS = ("coral tuna kelp reef tide wave shell pearl squid crab clam eel shark whale orca seal otter manta ray " +
    "guppy koi minnow perch trout salmon cod bass carp pike marlin barra snapper grouper wrasse goby blenny tang " +
    "puffer lantern anchor harbor lagoon atoll cove bay inlet shoal sandbar dune foam spray brine current eddy swell " +
    "surf drift buoy beacon lighthouse compass sextant mast sail keel rudder hull deck oar paddle kayak canoe dinghy " +
    "skiff schooner sloop ketch dory raft float bubble splash ripple pebble driftwood seaweed urchin starfish limpet " +
    "nautilus octopus cuttle shrimp prawn krill plankton algae sponge anemone barnacle mussel oyster scallop conch " +
    "cowrie abalone dolphin narwhal walrus puffin gull tern pelican heron egret ibis sandpiper").split(" ");

  function newCode() {
    const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
    const n = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100).padStart(2, "0");
    return `${pick()}-${pick()}-${pick()}-${pick()}-${n}`;
  }

  const getCode = () => localStorage.getItem(POND_KEY);
  let lastSynced = null;
  let pending = false; // a save that hasn't reached AWS yet (offline etc.)

  function payload() {
    return { settings: state.settings, trips: state.trips };
  }

  async function push() {
    const code = getCode();
    if (!code || !state.settings) return;
    try {
      const res = await fetch(URL_, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, data: payload(), updatedAt: state.updatedAt || Date.now() }),
      });
      if (!res.ok) throw new Error(res.status);
      pending = false;
      lastSynced = Date.now();
    } catch {
      pending = true; // try again next time she opens or saves
    }
    renderStatus();
  }

  // Pull the newest copy; use it if it's newer than this device's.
  async function pull() {
    const code = getCode();
    if (!code) return;
    if (pending) return push();
    try {
      const res = await fetch(`${URL_}?code=${encodeURIComponent(code)}`);
      if (res.status === 404) { await push(); return; }
      if (!res.ok) throw new Error(res.status);
      const remote = await res.json();
      if ((remote.updatedAt || 0) > (state.updatedAt || 0)) {
        state = { ...remote.data, updatedAt: remote.updatedAt };
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        render();
      }
      lastSynced = Date.now();
    } catch {
      // offline: keep using this device's copy
    }
    renderStatus();
  }

  // ---- the sync pop-up ----
  const dlg = $("sync-dlg");

  function renderStatus() {
    if (!dlg.open) return;
    const code = getCode();
    $("sync-off").hidden = !!code;
    $("sync-start").hidden = !state.settings; // on the setup screen she can only join
    $("sync-on").hidden = !code;
    if (code) {
      $("sync-code").textContent = code;
      $("sync-status").textContent = pending
        ? "Couldn't connect. It'll catch up next time you open the app."
        : lastSynced ? "In sync." : "Checking...";
    }
  }

  function openSync() {
    $("join-form").hidden = true;
    $("join-msg").textContent = "";
    dlg.showModal();
    renderStatus();
    if (getCode()) pull();
  }

  $("open-sync").addEventListener("click", openSync);
  $("sync-close").addEventListener("click", () => dlg.close());

  $("sync-start").addEventListener("click", async () => {
    localStorage.setItem(POND_KEY, newCode());
    state.updatedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    renderStatus();
    await push();
  });

  $("sync-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getCode());
      $("sync-copy").textContent = "copied";
      setTimeout(() => ($("sync-copy").textContent = "copy"), 1500);
    } catch { /* clipboard blocked: she can still read it off the screen */ }
  });

  $("sync-stop").addEventListener("click", async () => {
    const yes = await ask("Stop syncing on this device? Your trips stay here and on your other devices.", { ok: "stop", cancel: "keep syncing" });
    if (!yes) return;
    localStorage.removeItem(POND_KEY);
    openSync();
  });

  // Join an existing ocean (used from the sync pop-up and from the setup screen)
  async function join(rawCode) {
    const code = rawCode.trim().toLowerCase().replace(/\s+/g, "-");
    const msg = $("join-msg");
    msg.textContent = "Looking for that code...";
    try {
      const res = await fetch(`${URL_}?code=${encodeURIComponent(code)}`);
      if (res.status === 404 || res.status === 400) { msg.textContent = "Nothing saved under that code. Check the spelling?"; return; }
      if (!res.ok) throw new Error(res.status);
      const remote = await res.json();
      localStorage.setItem(POND_KEY, code);
      state = { ...remote.data, updatedAt: remote.updatedAt };
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      lastSynced = Date.now();
      dlg.close();
      render();
    } catch {
      msg.textContent = "Couldn't connect. Check the internet and try again.";
    }
  }

  $("sync-join-show").addEventListener("click", () => { $("join-form").hidden = false; $("join-code").focus(); });
  $("join-form").addEventListener("submit", (e) => { e.preventDefault(); join($("join-code").value); });
  $("setup-join").addEventListener("click", openSync);

  // Keep devices matched: pull when the app opens and whenever she comes back to it
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
  window.addEventListener("focus", pull);
  pull();

  window.Sync = { push, pull };
})();
