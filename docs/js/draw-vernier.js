/**
 * draw-vernier.js — Vernier caliper and measurement scene
 * Depends on: none
 */

const DrawVernier = (() => {
  const MODES = {
    external: { label: 'External diameter', min: 20, max: 150, unit: 'mm' },
    internal: { label: 'Internal diameter', min: 10, max: 90, unit: 'mm' },
    depth:    { label: 'Depth',             min: 0,  max: 40, unit: 'mm' },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let W = canvas.width;
    let H = canvas.height;

    let _mode = 'external';
    let _flippedH = false;
    let _flippedV = false;
    let _position = 80;
    let _object = {
      label: 'Measurement block',
      outer: 80,
      inner: 38,
      depth: 18,
      thickness: 30,
      hasInternal: true,
      hasDepth: true,
      type: 'block_hole',
    };

    let _onChange = null;

    function setObject(object) {
      _object = { ..._object, ...object };
      if (_mode === 'internal' && !_object.hasInternal) _mode = 'external';
      if (_mode === 'depth' && !_object.hasDepth) _mode = 'external';
      _position = clamp(_defaultPosition(), currentMode().min, currentMode().max);
      draw();
      if (_onChange) _onChange();
    }

    function setMode(mode) {
      if (!MODES[mode]) return;
      _mode = mode;
      if (_mode === 'internal' && !_object.hasInternal) _mode = 'external';
      if (_mode === 'depth' && !_object.hasDepth) _mode = 'external';
      _position = clamp(_defaultPosition(), currentMode().min, currentMode().max);
      draw();
      if (_onChange) _onChange();
    }

    function setFlip(horizontal, vertical) {
      _flippedH = horizontal;
      _flippedV = vertical;
      draw();
      if (_onChange) _onChange();
    }

    function setPosition(value) {
      _position = clamp(value, currentMode().min, currentMode().max);
      draw();
      if (_onChange) _onChange();
    }

    function reset() {
      _position = clamp(_defaultPosition(), currentMode().min, currentMode().max);
      draw();
      if (_onChange) _onChange();
    }

    function _defaultPosition() {
      if (_mode === 'external') return _object.outer;
      if (_mode === 'internal') return _object.hasInternal ? _object.inner : _object.outer;
      return _object.hasDepth ? _object.depth : 0;
    }

    function currentMode() {
      return MODES[_mode];
    }

    function getReading() {
      return +_position.toFixed(2);
    }

    function getState() {
      return {
        mode: _mode,
        flippedH: _flippedH,
        flippedV: _flippedV,
        position: getReading(),
        object: { ..._object },
      };
    }

    function draw() {
      W = canvas.width;
      H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      if (_flippedH) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      if (_flippedV) {
        ctx.translate(0, H);
        ctx.scale(1, -1);
      }

      _drawBackground();
      _drawObject();
      _drawCaliper();
      _drawScale();
      _drawReadout();
      _drawModeHint();
      _drawFeatureLegend();
      ctx.restore();
    }

    function _drawBackground() {
      ctx.fillStyle = '#081018';
      ctx.fillRect(0, 0, W, H);
      const gridColor = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 42) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 42) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    function _drawObject() {
      const scale = Math.min((W - 280) / _object.outer, (H - 260) / 120, 3.2);
      const objW = _object.outer * scale;
      const objH = 90;
      const cx = W * 0.65;
      const cy = H * 0.60;
      const left = cx - objW / 2;
      const top = cy - objH / 2;

      ctx.fillStyle = '#243047';
      ctx.shadowColor = '#00000060'; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(left, top, objW, objH, 16);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4f6a8d'; ctx.lineWidth = 2;
      ctx.stroke();

      if (_object.hasInternal) {
        const innerR = (_object.inner * scale) / 2;
        ctx.fillStyle = '#081018';
        ctx.beginPath();
        ctx.ellipse(cx, cy, innerR, innerR * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#74b0ff'; ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (_object.hasDepth) {
        const pocketW = objW * 0.38;
        const pocketH = _object.depth * scale;
        const px = cx + objW * 0.08;
        const py = cy - objH / 2;
        ctx.fillStyle = '#14203b';
        ctx.beginPath();
        ctx.roundRect(px, py, pocketW, pocketH, 10);
        ctx.fill();
        ctx.strokeStyle = '#4f6a8d'; ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(132, 193, 255, 0.12)';
        ctx.fillRect(px + 2, py + 2, pocketW - 4, pocketH - 4);
      }

      ctx.fillStyle = '#d6e6ff';
      ctx.font = '600 13px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(_object.label, cx, top - 16);
    }

    function _drawCaliper() {
      const scale = Math.min((W - 280) / _object.outer, (H - 260) / 120, 3.2);
      const beamY = H * 0.20;
      const beamX0 = 80;
      const beamX1 = W - 80;
      const beamH = 24;
      const beamGrip = 140;
      const measure = _position * scale;
      const headY = beamY + beamH / 2;
      const objectCenter = W * 0.65;
      const leftJawTip = objectCenter - measure / 2;
      const rightJawTip = objectCenter + measure / 2;

      const beamGradient = ctx.createLinearGradient(beamX0, beamY, beamX1, beamY);
      beamGradient.addColorStop(0, '#1d2c44');
      beamGradient.addColorStop(1, '#152139');
      ctx.fillStyle = beamGradient;
      ctx.strokeStyle = '#5d80b4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(beamX0, beamY, beamX1 - beamX0, beamH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#17223b';
      ctx.fillRect(beamX0 - beamGrip, beamY - 6, beamGrip, beamH + 12);
      ctx.strokeStyle = '#4f6a8d'; ctx.lineWidth = 1.5;
      ctx.strokeRect(beamX0 - beamGrip, beamY - 6, beamGrip, beamH + 12);
      ctx.fillStyle = '#203054';
      for (let i = 0; i < 8; i += 1) {
        ctx.fillRect(beamX0 - beamGrip + 10, beamY - 2 + i * 8, beamGrip - 20, 3);
      }

      const fixedX = beamX1 - 34;
      const fixedTip = _mode === 'depth' ? fixedX - 18 : fixedX;
      ctx.fillStyle = '#5a6f96';
      ctx.beginPath();
      ctx.moveTo(fixedX, headY - 36);
      ctx.lineTo(fixedX, headY + 36);
      ctx.lineTo(fixedTip + 16, headY + 36);
      ctx.lineTo(fixedTip + 16, headY + 18);
      ctx.lineTo(fixedX + 3, headY + 18);
      ctx.lineTo(fixedX + 3, headY - 18);
      ctx.lineTo(fixedTip + 16, headY - 18);
      ctx.lineTo(fixedTip + 16, headY - 36);
      ctx.closePath();
      ctx.fill();

      const jawX = leftJawTip - 14;
      ctx.fillStyle = '#5a6f96';
      ctx.beginPath();
      ctx.moveTo(jawX, headY - 36);
      ctx.lineTo(jawX, headY + 36);
      ctx.lineTo(jawX + 14, headY + 36);
      ctx.lineTo(jawX + 14, headY + 20);
      ctx.lineTo(jawX + 22, headY + 20);
      ctx.lineTo(jawX + 22, headY - 20);
      ctx.lineTo(jawX + 14, headY - 20);
      ctx.lineTo(jawX + 14, headY - 36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5d80b4'; ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#7ea1d5';
      ctx.fillRect(leftJawTip - 6, headY - 42, 12, 36);
      ctx.fillRect(rightJawTip - 6, headY + 6, 12, 36);
      if (_mode === 'internal') {
        ctx.fillRect(leftJawTip - 6, headY + 6, 12, 36);
        ctx.fillRect(rightJawTip - 6, headY - 42, 12, 36);
      }
      if (_mode === 'depth') {
        const rodX = fixedTip + 14;
        const rodLength = Math.max(20, measure);
        ctx.fillStyle = '#7ea1d5';
        ctx.fillRect(rodX, headY - 14, 10, rodLength);
        ctx.fillStyle = '#e4f5ff';
        ctx.fillRect(rodX + 2, headY + rodLength - 4, 6, 6);
      }

      ctx.strokeStyle = 'rgba(77,240,176,0.75)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      if (_mode === 'depth') {
        const pocketX = W * 0.65 + (_object.outer * scale) * 0.22;
        const pocketY = H * 0.60 - 45;
        const rodX = fixedTip + 20;
        ctx.moveTo(rodX + 5, headY + Math.max(20, measure));
        ctx.lineTo(rodX + 5, pocketY + 4);
        ctx.lineTo(pocketX, pocketY + 4);
      } else {
        const yStart = headY + 18;
        ctx.moveTo(leftJawTip, yStart);
        ctx.lineTo(leftJawTip, H * 0.60 - 12);
        ctx.moveTo(rightJawTip, yStart);
        ctx.lineTo(rightJawTip, H * 0.60 - 12);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const tickY = beamY + beamH + 16;
      const tickLength = 16;
      const tickSpacing = 12;
      const scaleStart = beamX0 + 12;
      ctx.strokeStyle = '#86c8ff'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(scaleStart, tickY);
      ctx.lineTo(scaleStart + 170 * tickSpacing / 10, tickY);
      ctx.stroke();
      for (let i = 0; i <= 17; i += 1) {
        const x = scaleStart + i * tickSpacing;
        const len = i % 5 === 0 ? tickLength : tickLength * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, tickY);
        ctx.lineTo(x, tickY - len);
        ctx.stroke();
        if (i % 5 === 0) {
          ctx.fillStyle = '#d6e6ff';
          ctx.font = '10px DM Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(i * 10, x, tickY - len - 6);
        }
      }
    }

    function _drawScale() {
      const label = currentMode().label;
      ctx.fillStyle = '#d6e6ff';
      ctx.font = '700 18px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 78, H * 0.88);
      ctx.font = '500 16px DM Mono, monospace';
      ctx.fillStyle = '#74c2ff';
      ctx.fillText(`${_position.toFixed(2)} mm`, 78, H * 0.92);
    }

    function _drawReadout() {
      ctx.fillStyle = '#0d1624';
      ctx.fillRect(W - 330, H * 0.78, 240, 72);
      ctx.strokeStyle = '#4f6a8d'; ctx.lineWidth = 1.5;
      ctx.strokeRect(W - 330, H * 0.78, 240, 72);
      ctx.fillStyle = '#7fdfff';
      ctx.font = '700 22px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${_position.toFixed(2)} mm`, W - 210, H * 0.82);
      ctx.font = '12px DM Sans, sans-serif';
      ctx.fillStyle = '#a8b4d0';
      ctx.fillText('Current reading', W - 210, H * 0.86);
      ctx.fillText('Use the slider to match the object.', W - 210, H * 0.93);
    }

    function _drawModeHint() {
      const hint = `Mode: ${currentMode().label}`;
      ctx.fillStyle = '#c6d8ff';
      ctx.font = '500 14px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(hint, 78, H * 0.96);
    }

    function _drawFeatureLegend() {
      const baseX = W - 330;
      const baseY = H * 0.92;
      ctx.font = '11px DM Sans, sans-serif';
      ctx.fillStyle = _object.hasInternal ? '#7df9a1' : '#ff7d7d';
      ctx.fillText(`Internal feature: ${_object.hasInternal ? 'Yes' : 'No'}`, baseX, baseY);
      ctx.fillStyle = _object.hasDepth ? '#7df9a1' : '#ff7d7d';
      ctx.fillText(`Depth feature: ${_object.hasDepth ? 'Yes' : 'No'}`, baseX, baseY + 16);
    }

    return {
      setObject,
      setMode,
      setFlip,
      setPosition,
      reset,
      getReading,
      getState,
      draw,
    };
  }

  return { create };
})();
