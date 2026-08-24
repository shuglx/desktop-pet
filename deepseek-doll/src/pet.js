/* ============================================================
   DeepSeek Doll 桌宠 — 移植自 dsh-pet（PC2005-cloud/dsh-pet, MIT）
   原项目为 DeepSeek Harness 的 Cordis 插件（React），
   此处移植为原生 JS：动画链 / 双缓冲切换 / 点击拖拽 / 屏幕漫游
   动画资源: assets/pet/<动画名>.webm（透明背景, 640x360 画布）
   ============================================================ */
const pet = {
  /* ---------- 动画目录（事实来源：src/pet 下的 webm 文件） ---------- */
  IDLE: '待机呼吸休闲',
  TURN: '东张西望',
  ACTS: [
    // 日常/互动
    '超大伸懒腰', '悠闲哼歌', '哈欠连天', '打瞌睡被惊醒', '原地小憩沉眠',
    '原地专心玩魔方', '原地敲击桌面互动', '原地重力下蹲压缩', '原地跳跃抓碎头顶物品',
    '原地蹲下玩玩具汽车', '偷吃零食被抓住', '玩游戏气急败坏', '被吓一跳',
    '小幅度原地360度旋转展示', '鲸鱼吐泡泡特效', '女仆屈膝礼仪', '荡秋千',
    '骑木马', '抽陀螺', '吹笛子', '踢毽子', '下五子棋', '三球抛接', '凭空生花',
    '扑克魔术', '撸猫', '萌化小幽灵', '蝴蝶蜜蜂环绕头顶开花', '玩水枪',
    // 换装 / 休闲
    '整体换装试色', '照镜子', '优雅女仆舞', '轻快摇摆舞', '可爱宅舞', '吹气球',
    '摇扇纳凉', '轻快记录',
    // 吃喝
    '吃早餐', '吃午餐', '吃晚餐', '吃白饭', '吃冰淇淋融化', '吃西瓜', '大口吃零食',
    '吃Token', '吃年糕', '吃青团', '吃汤圆', '吃粽子', '吃饺子', '吃糖葫芦',
    '吃长寿面', '吃重阳糕', '吃大闸蟹', '吃腊八粥', '晨间刷牙',
    // 节日 / 场景
    '动物环绕', '深度思考碎碎念', '写代码', '放风筝', '被落叶淹没', '蓝鲸现世',
    '用鲸鱼尾巴拍打地面', '小提琴演奏', '堆雪人', '中秋赏月吃月饼', '放河灯',
    '放孔明灯', '放烟花', '变鸽子', '插茱萸赏菊', '穿针乞巧', '拆礼物', '收红包',
    '写福字', '装点圣诞树', '讨糖南瓜灯', '舞狮头', '涮火锅', '是啊，吃什么',
  ],
  CLICKS: [
    '点击回应-开心跃动', '点击回应-害羞惊讶', '点击回应-傲娇生气',
    '点击回应-挠痒咯咯笑', '点击回应-元气挥手',
  ],
  DRAG: '被鼠标拖拽悬空反馈',
  MOVES: ['螃蟹走路', '原地漂浮踏步', '原地左转奔跑'],

  // thumb 画布 640x360，人物脚底在 y=330；命中矩形（人物区域）
  CANVAS_H: 360, FEET_Y: 330,
  HIT_BOX: { x0: 200, y0: 50, x1: 440, y1: 335 },
  // 移动参数（px / 秒）
  MOVE_MIN_PX: 60, MOVE_MAX_PX: 240, MOVE_MARGIN: 20,
  MOVE_LEAD_SEC: 2, MOVE_TAIL_SEC: 2,
  DRAG_THRESHOLD: 5,

  /* ---------- 运行时状态 ---------- */
  on: false,
  allowMove: true, // 默认允许移动；由托盘“允许移动”开关控制
  root: null, stage: null, vids: [], front: 0,
  anim: null, facing: 'left',
  pending: null, gen: 0,
  drag: { active: false, dragging: false, sx: 0, sy: 0, offX: 0, offY: 0 },
  justDragged: false,
  moveId: null, moveToken: 0, pendingMove: null, customPos: null,
  _onResize: null,

  get size() { return window.innerWidth <= 820 ? 260 : 340; },

  /* ---------- 挂载 / 卸载 ---------- */
  mount() {
    if (this.on) return;
    this.on = true;
    this.anim = this.IDLE;
    this.facing = 'left';
    this.customPos = null;
    this.pending = null;
    this.pendingMove = null;
    this.gen = 0;

    const root = document.createElement('div');
    root.className = 'pet-root';
    const stage = document.createElement('div');
    stage.className = 'pet-stage';
    root.appendChild(stage);

    // 双缓冲 video：A 初始显示，B 待命
    for (let i = 0; i < 2; i++) {
      const v = document.createElement('video');
      v.className = 'pet-video' + (i === 0 ? ' is-front' : '');
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      stage.appendChild(v);
      this.vids[i] = v;
    }
    this.front = 0;

    // 命中层：覆盖人物区域，承载全部交互（视频本身点击穿透）
    const hit = document.createElement('div');
    hit.className = 'pet-hit';
    hit.style.left = (this.HIT_BOX.x0 / 640 * 100) + '%';
    hit.style.top = (this.HIT_BOX.y0 / 360 * 100) + '%';
    hit.style.width = ((this.HIT_BOX.x1 - this.HIT_BOX.x0) / 640 * 100) + '%';
    hit.style.height = ((this.HIT_BOX.y1 - this.HIT_BOX.y0) / 360 * 100) + '%';
    hit.addEventListener('pointerdown', e => this.pDown(e));
    hit.addEventListener('pointermove', e => this.pMove(e));
    hit.addEventListener('pointerup', e => this.pUp(e));
    hit.addEventListener('pointercancel', e => this.pUp(e));
    hit.addEventListener('click', e => this.pClick(e));
    hit.addEventListener('mouseenter', () => { if (!this.drag.active) hit.style.cursor = 'grab'; });
    hit.addEventListener('mouseleave', () => { if (!this.drag.active) hit.style.cursor = 'default'; });
    stage.appendChild(hit);

    document.body.appendChild(root);
    this.root = root;
    this.stage = stage;
    this.applyFootAlign(false);

    // resize：按比例重算位置并钳制回窗口内
    this._onResize = () => {
      if (!this.customPos) return;
      this.applyCustomPos();
    };
    window.addEventListener('resize', this._onResize);

    this.switchTo(this.IDLE, true);
  },

  unmount() {
    if (!this.on) return;
    this.on = false;
    this.stopMove();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.vids.forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} });
    if (this.root) this.root.remove();
    this.root = this.stage = null;
    this.vids = [];
  },

  toggle() {
    this.on ? this.unmount() : this.mount();
    return this.on;
  },

  /* ---------- 双缓冲切换（交叉淡入, 永不闪空白） ---------- */
  switchTo(next, once) {
    if (!this.on) return;
    // 目标已在加载中：跳过
    if (this.pending && this.pending.anim === next) return;
    const gen = ++this.gen;
    this.pending = { anim: next, gen };

    const el = this.vids[this.front === 0 ? 1 : 0];
    el.src = 'pet/' + encodeURIComponent(next) + '.webm'; // 独立版：webm 位于 src/pet/
    el.loop = false;            // 链式模型：全部一次性播放
    el.muted = true;
    el.onended = () => this.handleEnded(el);

    const onReady = () => {
      el.removeEventListener('loadeddata', onReady);
      if (!this.pending || this.pending.gen !== gen) return; // 过期切换
      const old = this.vids[this.front];
      el.classList.add('is-front');
      if (old !== el) old.classList.remove('is-front');
      // 关键：立即停掉被换下的旧视频。否则它继续在后台播放，
      // 播完时 ended 事件会在新动画中途触发一次“插播”
      // （拖拽/点击/菜单播放等中途打断后必然发生）。
      if (old !== el) {
        old.onended = null;
        try { old.pause(); } catch (e) {}
      }
      this.front = this.front === 0 ? 1 : 0;
      this.pending = null;
      // 朝向镜像用 inline transform（旧视频保持原朝向淡出，不闪）
      el.style.transform = this.facing === 'right' ? 'scaleX(-1)' : '';
      el.play().catch(() => {});
      if (this.pendingMove) this.startMoveDrive(el);
    };
    el.addEventListener('loadeddata', onReady);
    if (el.readyState >= 2) onReady();
    el.load();
  },

  /* ---------- 动画链：播完按概率选下一个（30 待机/10 转向/40 动作/20 移动） ---------- */
  pickNext() {
    const roll = Math.random();
    let next;
    if (roll < 0.3) next = this.IDLE;
    else if (roll < 0.4) next = this.TURN;
    else if (roll < 0.8) next = this.pick(this.ACTS);
    else if (!this.tryMove()) next = this.pick(this.ACTS); // 空间不够回退动作
    else return; // tryMove 已安排移动动画
    this.anim = next;
    this.switchTo(next, true);
  },

  handleEnded(el) {
    if (!this.on) return;
    if (this.pending) return;                       // 已有切换在加载中：忽略
    if (el && el !== this.vids[this.front]) return; // 过期的 ended（非前台视频）：忽略
    if (this.drag.active) return;              // 拖拽中不打断
    if (this.anim === this.TURN)               // 东张西望播完 → 翻转朝向
      this.facing = this.facing === 'left' ? 'right' : 'left';
    if (this.anim === this.DRAG || this.CLICKS.includes(this.anim)) {
      this.anim = this.IDLE;                   // 用户打断后先回待机缓冲
      this.switchTo(this.IDLE, true);
      return;
    }
    this.pickNext();
  },

  /* ---------- 托盘“播放动作”：手动指定播放一个动画，播完回动画链 ---------- */
  playOnce(name) {
    if (!this.on) return;
    this.stopMove();
    this.anim = name;
    this.switchTo(name, true);
  },

  /* ---------- 移动系统：动画提供姿态, rAF 驱动位置 ---------- */
  currentCenterX() {
    if (this.customPos) return this.customPos.rx * window.innerWidth;
    if (this.root) return this.root.getBoundingClientRect().left + this.root.offsetWidth / 2;
    return window.innerWidth - 44 - this.size / 2;
  },
  currentCenterY() {
    if (this.customPos) return this.customPos.ry * window.innerHeight;
    if (this.root) return this.root.getBoundingClientRect().top + this.root.offsetHeight / 2;
    return window.innerHeight - 64 - this.size * 9 / 16 / 2;
  },

  tryMove() {
    if (!this.allowMove) return false; // 托盘“允许移动”关闭：跳过移动动画
    if (this.moveId !== null || this.pendingMove) return true;
    // 方向按实际朝向（东张西望播完 facing 即将翻转, 方向取反）
    const dir = (this.facing === 'right') !== (this.anim === this.TURN) ? 1 : -1;
    const W = window.innerWidth;
    const cx = this.currentCenterX();
    const halfW = this.size / 2;
    const target = cx + dir * (this.MOVE_MIN_PX + Math.random() * (this.MOVE_MAX_PX - this.MOVE_MIN_PX));
    if (target < this.MOVE_MARGIN + halfW || target > W - this.MOVE_MARGIN - halfW) return false;
    this.pendingMove = {
      startRatio: cx / W,
      startYRatio: this.currentCenterY() / window.innerHeight,
      targetRatio: target / W,
      dir,
      totalRatio: Math.abs(target - cx) / W,
    };
    this.anim = this.pick(this.MOVES);
    this.switchTo(this.anim, true);
    return true;
  },

  startMoveDrive(el) {
    const pm = this.pendingMove;
    if (!pm || this.moveId !== null) return;
    this.pendingMove = null;
    const { startRatio, startYRatio, targetRatio, dir, totalRatio } = pm;
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 10.09;
    const travelWindow = Math.max(0.1, duration - this.MOVE_LEAD_SEC - this.MOVE_TAIL_SEC);
    const halfW = this.size / 2, halfH = this.size * 9 / 16 / 2;
    const token = ++this.moveToken;
    const step = () => {
      if (this.moveToken !== token || !this.on) return;
      if (el !== this.vids[this.front]) { this.moveId = null; return; } // 移动动画已被换下：停止驱动
      const t = el.currentTime || 0;
      let ratioX;
      if (t <= this.MOVE_LEAD_SEC) ratioX = startRatio;
      else if (t >= duration - this.MOVE_TAIL_SEC) ratioX = targetRatio;
      else ratioX = startRatio + dir * totalRatio * ((t - this.MOVE_LEAD_SEC) / travelWindow);
      this.setCenter(ratioX * window.innerWidth, startYRatio * window.innerHeight, halfW, halfH);
      if (t < duration - this.MOVE_TAIL_SEC) {
        this.moveId = requestAnimationFrame(step);
      } else {
        this.moveId = null;
        this.customPos = { rx: targetRatio, ry: startYRatio };
      }
    };
    this.moveId = requestAnimationFrame(step);
  },

  stopMove() {
    this.pendingMove = null;
    this.moveToken++;
    if (this.moveId !== null) {
      cancelAnimationFrame(this.moveId);
      this.moveId = null;
    }
  },

  setCenter(cx, cy, halfW, halfH) {
    if (!this.root) return;
    const W = window.innerWidth, H = window.innerHeight;
    const left = Math.min(Math.max(cx - halfW, 0), W - halfW * 2);
    const top = Math.min(Math.max(cy - halfH, 0), H - halfH * 2);
    this.root.style.left = left + 'px';
    this.root.style.top = top + 'px';
    this.root.style.right = 'auto';
    this.root.style.bottom = 'auto';
  },

  applyCustomPos() {
    const cp = this.customPos;
    if (!cp || !this.root) return;
    this.setCenter(cp.rx * window.innerWidth, cp.ry * window.innerHeight, this.size / 2, this.size * 9 / 16 / 2);
  },

  // 落地对齐：脚底(330/360)下移出舞台, 让"脚"落在视口底线上
  applyFootAlign(draggingNow) {
    if (!this.stage) return;
    const pad = this.size * 9 / 16 * (this.CANVAS_H - this.FEET_Y) / this.CANVAS_H;
    this.stage.style.transform = draggingNow ? 'none' : 'translateY(' + pad + 'px)';
  },

  /* ---------- 点击 / 拖拽（5px 阈值区分） ---------- */
  pDown(e) {
    e.currentTarget.classList.add('dragging');
    this.stopMove();
    e.currentTarget.setPointerCapture(e.pointerId);
    let offX = 0, offY = 0;
    if (this.root) {
      const rr = this.root.getBoundingClientRect();
      offX = e.clientX - (rr.left + rr.width / 2);
      offY = e.clientY - (rr.top + rr.height / 2);
    }
    this.drag = { active: true, dragging: false, sx: e.clientX, sy: e.clientY, offX, offY };
  },

  pMove(e) {
    const d = this.drag;
    if (!d.active) return;
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < this.DRAG_THRESHOLD) return;
      d.dragging = true;
      this.anim = this.DRAG;
      this.switchTo(this.DRAG, true);
    }
    if (this.root) {
      const halfW = this.size / 2, halfH = this.size * 9 / 16 / 2;
      this.root.style.left = (e.clientX - d.offX - halfW) + 'px';
      this.root.style.top = (e.clientY - d.offY - halfH) + 'px';
      this.root.style.right = 'auto';
      this.root.style.bottom = 'auto';
    }
    this.applyFootAlign(true);
  },

  pUp(e) {
    const d = this.drag;
    const wasDragging = d.dragging;
    d.active = false;
    d.dragging = false;
    e.currentTarget.classList.remove('dragging');
    if (wasDragging) {
      this.justDragged = true;                 // 抑制拖完后的幽灵 click
      setTimeout(() => { this.justDragged = false; }, 100);
      // 停在松手处（保持抓取偏移）, 存窗口比例
      this.customPos = {
        rx: (e.clientX - d.offX) / window.innerWidth,
        ry: (e.clientY - d.offY) / window.innerHeight,
      };
      this.applyFootAlign(false);
      this.anim = this.IDLE;
      this.switchTo(this.IDLE, true);
    }
  },

  pClick() {
    if (this.drag.active || this.drag.dragging || this.justDragged) return;
    this.stopMove();
    this.anim = this.pick(this.CLICKS);
    this.switchTo(this.anim, true);
  },

  /* ---------- 工具 ---------- */
  pick(pool) {
    const entries = this.anim ? pool.filter(n => n !== this.anim) : pool; // 避免连续重复
    return entries[Math.floor(Math.random() * entries.length)];
  },
};
