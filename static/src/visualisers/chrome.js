export function createVisualiserChrome({ $, redrawCanvas, resizeThree, resizeMemoryPalace }) {
  function responsiveFill(width, height) {
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    if (w < 760 || h < 520) return 1;
    const widthFill = Math.max(0, Math.min(1, (w - 760) / 760));
    const heightFill = Math.max(0, Math.min(1, (h - 520) / 360));
    return 1 + Math.min(.22, (widthFill * .16) + (heightFill * .06));
  }

  async function toggleFullscreen(selector) {
    const el = $(selector);
    if (!el || !document.fullscreenEnabled) return;
    if (document.fullscreenElement === el) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }

  async function exitFullscreen(event) {
    event?.stopPropagation?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  }

  function updateFullscreenButtons() {
    const current = document.fullscreenElement;
    const constellation = current === $('.constellation-wrap');
    const three = current === $('#threeViewport');
    const palace = current === $('#palaceViewport');
    const constellationButton = $('#constellationFullscreen');
    const threeButton = $('#threeFullscreen');
    const palaceButton = $('#palaceFullscreen');
    if (constellationButton) constellationButton.textContent = constellation ? 'Exit fullscreen' : 'Fullscreen';
    if (threeButton) threeButton.textContent = three ? 'Exit fullscreen' : 'Fullscreen';
    if (palaceButton) palaceButton.textContent = palace ? 'Exit fullscreen' : 'Fullscreen';
    redrawCanvas();
    resizeThree();
    resizeMemoryPalace();
  }

  return {
    exitFullscreen,
    responsiveFill,
    toggleFullscreen,
    updateFullscreenButtons,
  };
}
