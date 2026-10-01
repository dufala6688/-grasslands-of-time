  function readyImg(im) {
    return im && im.complete && im.naturalWidth > 0;
  }

  function drawScene() {
    ctx.fillStyle = "#74b56f";
    ctx.fillRect(0, 0, state.w, state.h);
    const im = SPR.scene;
    if (!readyImg(im)) return;
    const iw = im.naturalWidth;
    const ih = im.naturalHeight;
    const scale = Math.max(state.w / iw, state.h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(im, (state.w - dw) / 2, (state.h - dh) / 2, dw, dh);
  }

  function drawSprite(img, x, y, scale, flip, rot) {
    if (!readyImg(img)) return;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(img, -dw / 2, -dh + 8, dw, dh);
    ctx.restore();
  }

  function animalFrame(a) {
    const set = SPR[a.type];
    if (a.lift > 0.35) return set.drag;
    if (a.jump > 0.12) return set.jump;
    if (a.nap > 0) return set.sleep;
    if (a.eating) {
      const f = 1 + Math.floor((a.eatT / 220) % 3);
      return set["eat" + f] || set.eat1;
    }
    if (a.approach) return set.eat1;
    if (len(a.vx, a.vy) > 14) {
      const f = 1 + (Math.floor(a.bob * 2.2) % 2);
      return set["walk" + f] || set.idle;
    }
    return set.idle;
  }

  function drawGrassTuft(g) {
    const near =
      state.drag &&
      len(state.drag.animal.x - g.x, state.drag.animal.y - g.y) < NEAR_GRASS;
    const s = persp(g.y) * g.scale * 0.42;
    if (near) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x, g.y, NEAR_GRASS * persp(g.y), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const img = SPR.grass[g.kind] || SPR.grass[0];
    const sway = Math.sin(state.wind * 1.6 + g.sway) * (0.08 + state.gust * 0.2);
    drawSprite(img, g.x, g.y, s, false, sway);
  }

  function drawProgress(x, y, t, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }

  function drawAnimal(a) {
    const bounce = a.jump * -14;
    const s = persp(a.y) * (a.type === "cow" ? 0.34 : 0.3);
    const flip = Math.cos(a.heading) > 0;
    drawSprite(animalFrame(a), a.x, a.y + bounce, s, flip);
    if (a.eating) drawProgress(a.x, a.y - 40 * persp(a.y), clamp(a.eatT / EAT_MS, 0, 1), "#c48a4a");
  }

  function drawDog() {
    const d = state.dog;
    if (!d) return;
    const s = persp(d.y) * 0.38;
    const flip = Math.cos(d.heading) > 0;
    let frame = SPR.dog.idle;
    if (d.pose === "landing") frame = SPR.dog.land;
    else if (d.pose === "sit") frame = Math.floor(d.bob) % 2 === 0 ? SPR.dog.sit1 : SPR.dog.sit2;
    else if (d.pose === "run" || len(d.vx, d.vy) > 20) {
      const f = 1 + (Math.floor(d.bob * 1.6) % 4);
      frame = SPR.dog["walk" + f] || SPR.dog.walk1;
      if (len(d.vx, d.vy) > 80) frame = SPR.dog.herd;
    }
    drawSprite(frame, d.x, d.y, s, flip);
  }

