(() => {
    const COLORS = Object.freeze({
        navy: '#000b78',
        blue: '#1957d2',
        teal: '#008b84',
        cyan: '#62e7df',
        yellow: '#ffd84a',
        red: '#c62828',
        white: '#ffffff',
        ink: '#111817'
    });

    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
    const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
    const easeInOut = (value) => {
        const t = clamp(value);
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    window.installCombatAnimations = (GameState) => {
        const proto = GameState.prototype;

        proto.drawCombatFrame = function(playerX = 150, enemyX = 650) {
            if (!this.battleCtx || !this.battleCanvas) return;
            this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
            this.renderFighterOnBattleCanvas(this.playerFighter, playerX, 200, 0.3, false);
            this.renderFighterOnBattleCanvas(this.enemyFighter, enemyX, 200, 0.3, true);
        };

        proto.runCombatSequence = function(duration, drawFrame, complete) {
            if (!this.battleCtx || !this.battleCanvas) return;
            if (this.battleAnimation) cancelAnimationFrame(this.battleAnimation);

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.renderBattle();
                complete?.();
                return;
            }

            const startedAt = performance.now();
            const tick = (now) => {
                const progress = clamp((now - startedAt) / duration);
                drawFrame(progress, now - startedAt);
                if (progress < 1) {
                    this.battleAnimation = requestAnimationFrame(tick);
                } else {
                    this.battleAnimation = null;
                    this.renderBattle();
                    complete?.();
                }
            };
            this.battleAnimation = requestAnimationFrame(tick);
        };

        proto.drawSequenceLabel = function(label, progress, color = COLORS.navy) {
            const ctx = this.battleCtx;
            ctx.save();
            ctx.globalAlpha = clamp(Math.min(progress * 5, (1 - progress) * 5));
            ctx.fillStyle = color;
            ctx.fillRect(18, 18, 128, 20);
            ctx.fillStyle = COLORS.white;
            ctx.font = '700 11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 26, 28);
            ctx.restore();
        };

        proto.drawPixelBurst = function(x, y, progress, color = COLORS.yellow, count = 18, radius = 82) {
            const ctx = this.battleCtx;
            const t = clamp(progress);
            ctx.save();
            for (let index = 0; index < count; index++) {
                const angle = (Math.PI * 2 * index / count) + (index % 3) * 0.13;
                const distance = easeOut(t) * radius * (0.55 + (index % 5) * 0.1);
                const size = Math.max(2, 7 - t * 5 + (index % 2) * 2);
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = index % 3 === 0 ? COLORS.white : index % 2 ? color : COLORS.red;
                ctx.fillRect(
                    Math.round(x + Math.cos(angle) * distance - size / 2),
                    Math.round(y + Math.sin(angle) * distance - size / 2),
                    Math.round(size),
                    Math.round(size)
                );
            }
            ctx.restore();
        };

        proto.drawTargetReticle = function(x, y, radius, alpha, color = COLORS.red) {
            const ctx = this.battleCtx;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 5]);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.fillRect(x - radius - 9, y - 2, 18, 4);
            ctx.fillRect(x + radius - 9, y - 2, 18, 4);
            ctx.fillRect(x - 2, y - radius - 9, 4, 18);
            ctx.fillRect(x - 2, y + radius - 9, 4, 18);
            ctx.restore();
        };

        proto.animateAttack = function(attacker, defender, isPlayerAttacking) {
            const direction = isPlayerAttacking ? 1 : -1;
            const startX = isPlayerAttacking ? 150 : 650;
            const targetX = isPlayerAttacking ? 650 : 150;
            let impactTriggered = false;

            this.runCombatSequence(620, (progress) => {
                let attackerX = startX;
                if (progress < 0.18) {
                    attackerX -= direction * 24 * easeOut(progress / 0.18);
                } else if (progress < 0.56) {
                    attackerX = startX - direction * 24
                        + direction * 450 * easeInOut((progress - 0.18) / 0.38);
                } else {
                    attackerX = targetX - direction * 68
                        - direction * 432 * easeOut((progress - 0.56) / 0.44);
                }

                this.drawCombatFrame(
                    isPlayerAttacking ? attackerX : 150,
                    isPlayerAttacking ? 650 : attackerX
                );
                const ctx = this.battleCtx;
                const dash = clamp((progress - 0.14) / 0.42);
                ctx.save();
                ctx.globalAlpha = Math.sin(dash * Math.PI) * 0.7;
                for (let index = 0; index < 5; index++) {
                    ctx.fillStyle = index % 2 ? COLORS.teal : COLORS.navy;
                    const trailX = attackerX - direction * (46 + index * 22);
                    ctx.fillRect(trailX, 164 + index * 13, direction * (36 + index * 5), 5);
                }
                ctx.restore();

                if (progress > 0.42) {
                    const impact = clamp((progress - 0.42) / 0.46);
                    const flash = 1 - impact;
                    ctx.save();
                    ctx.translate(targetX, 200);
                    ctx.globalAlpha = flash;
                    ctx.strokeStyle = COLORS.white;
                    ctx.lineWidth = 11;
                    ctx.beginPath();
                    ctx.moveTo(-52, 54);
                    ctx.lineTo(50, -55);
                    ctx.stroke();
                    ctx.strokeStyle = COLORS.yellow;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(-58, 48);
                    ctx.lineTo(44, -61);
                    ctx.moveTo(-35, 62);
                    ctx.lineTo(62, -37);
                    ctx.stroke();
                    ctx.restore();
                    this.drawPixelBurst(targetX, 200, impact, COLORS.yellow, 16, 72);
                    this.drawTargetReticle(targetX, 200, 34 + impact * 32, flash * 0.8, COLORS.red);

                    if (!impactTriggered) {
                        impactTriggered = true;
                        this.pulseArena('impact');
                        this.playTone(96, 0.1, 'sawtooth', 0.034);
                    }
                }
                this.drawSequenceLabel(isPlayerAttacking ? 'SLASH.EXE' : 'HOSTILE_STRIKE', progress);
            });
        };

        proto.animateSpecialAttack = function(attacker, defender, isPlayerAttacking) {
            const startX = isPlayerAttacking ? 150 : 650;
            const targetX = isPlayerAttacking ? 650 : 150;
            const direction = isPlayerAttacking ? 1 : -1;
            let impactTriggered = false;

            this.runCombatSequence(920, (progress) => {
                let attackerX = startX;
                if (progress > 0.34 && progress < 0.62) {
                    attackerX = startX + direction * 435 * easeInOut((progress - 0.34) / 0.28);
                } else if (progress >= 0.62) {
                    attackerX = targetX - direction * 65
                        - direction * 435 * easeOut((progress - 0.62) / 0.38);
                }
                this.drawCombatFrame(
                    isPlayerAttacking ? attackerX : 150,
                    isPlayerAttacking ? 650 : attackerX
                );

                const ctx = this.battleCtx;
                if (progress < 0.42) {
                    const charge = easeOut(progress / 0.42);
                    for (let ring = 0; ring < 3; ring++) {
                        ctx.save();
                        ctx.globalAlpha = 0.8 - ring * 0.18;
                        ctx.strokeStyle = ring === 1 ? COLORS.yellow : COLORS.cyan;
                        ctx.lineWidth = 3;
                        ctx.setLineDash([4 + ring * 3, 5]);
                        ctx.beginPath();
                        ctx.arc(startX, 200, 72 - charge * 43 + ring * 17, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                    for (let tick = 0; tick < 8; tick++) {
                        const angle = tick * Math.PI / 4;
                        const radius = 78 - charge * 28;
                        ctx.fillStyle = tick % 2 ? COLORS.teal : COLORS.navy;
                        ctx.fillRect(startX + Math.cos(angle) * radius - 3, 200 + Math.sin(angle) * radius - 3, 6, 6);
                    }
                }

                if (progress > 0.5) {
                    const impact = clamp((progress - 0.5) / 0.5);
                    const flash = 1 - impact;
                    ctx.save();
                    ctx.translate(targetX, 200);
                    ctx.rotate(Math.PI / 4);
                    ctx.globalAlpha = flash;
                    ctx.strokeStyle = COLORS.cyan;
                    ctx.lineWidth = 8;
                    const size = 26 + impact * 92;
                    ctx.strokeRect(-size / 2, -size / 2, size, size);
                    ctx.strokeStyle = COLORS.white;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(-size * 0.32, -size * 0.32, size * 0.64, size * 0.64);
                    ctx.restore();
                    this.drawPixelBurst(targetX, 200, impact, COLORS.cyan, 28, 125);
                    this.drawTargetReticle(targetX, 200, 48 + impact * 70, flash, COLORS.teal);
                    if (!impactTriggered) {
                        impactTriggered = true;
                        this.pulseArena('special-impact');
                        this.playTone(146, 0.2, 'sawtooth', 0.04);
                    }
                }
                this.drawSequenceLabel(isPlayerAttacking ? 'OVERDRIVE.EXE' : 'HOSTILE_OVERDRIVE', progress, COLORS.teal);
            });
        };

        proto.animateDefend = function() {
            this.runCombatSequence(760, (progress) => {
                this.drawCombatFrame();
                const ctx = this.battleCtx;
                const alpha = Math.sin(progress * Math.PI);
                const radius = 50 + easeOut(progress) * 24;
                ctx.save();
                ctx.translate(150, 200);
                for (let ring = 0; ring < 3; ring++) {
                    const r = radius + ring * 13;
                    ctx.globalAlpha = alpha * (1 - ring * 0.22);
                    ctx.strokeStyle = ring === 1 ? COLORS.cyan : COLORS.navy;
                    ctx.lineWidth = ring === 0 ? 6 : 3;
                    ctx.beginPath();
                    for (let point = 0; point < 6; point++) {
                        const angle = -Math.PI / 2 + point * Math.PI / 3;
                        const x = Math.cos(angle) * r;
                        const y = Math.sin(angle) * r;
                        if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.fillStyle = COLORS.cyan;
                ctx.globalAlpha = alpha * 0.65;
                ctx.fillRect(-42, -2, 84, 4);
                ctx.fillRect(-2, -42, 4, 84);
                ctx.restore();
                this.drawSequenceLabel('GUARD.SYS', progress, COLORS.navy);
            }, () => this.playTone(210, 0.08, 'square', 0.018));
        };

        proto.animatePowerUp = function() {
            this.runCombatSequence(820, (progress) => {
                this.drawCombatFrame();
                const ctx = this.battleCtx;
                const alpha = Math.sin(progress * Math.PI);
                ctx.save();
                ctx.translate(150, 200);
                for (let lane = -2; lane <= 2; lane++) {
                    const x = lane * 22;
                    const offset = ((progress * 190 + lane * 17) % 150) - 75;
                    ctx.globalAlpha = alpha * (1 - Math.abs(lane) * 0.12);
                    ctx.fillStyle = lane % 2 ? COLORS.teal : COLORS.yellow;
                    ctx.fillRect(x - 3, 62 - offset, 6, 24);
                    ctx.fillRect(x - 8, 62 - offset, 16, 4);
                }
                for (let row = 0; row < 3; row++) {
                    const y = 38 - row * 27 - progress * 22;
                    ctx.strokeStyle = row === 1 ? COLORS.white : COLORS.yellow;
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(-30, y + 14);
                    ctx.lineTo(0, y - 10);
                    ctx.lineTo(30, y + 14);
                    ctx.stroke();
                }
                ctx.restore();
                this.drawSequenceLabel(`POWER_STACK.${this.battleState.powerUpCount}`, progress, COLORS.teal);
            }, () => this.playTone(410, 0.1, 'square', 0.02));
        };

        proto.animateDodge = function() {
            this.runCombatSequence(480, (progress) => {
                const shift = Math.sin(progress * Math.PI) * 64;
                this.drawCombatFrame(150 - shift, 650);
                const ctx = this.battleCtx;
                ctx.save();
                for (let index = 0; index < 4; index++) {
                    ctx.globalAlpha = (1 - progress) * (0.65 - index * 0.12);
                    ctx.strokeStyle = index % 2 ? COLORS.cyan : COLORS.navy;
                    ctx.lineWidth = 4;
                    ctx.strokeRect(105 - index * 25, 155 + index * 9, 48, 86);
                }
                ctx.restore();
                this.drawSequenceLabel('EVADE.ARMED', progress, COLORS.teal);
            });
        };

        proto.animateRepair = function() {
            this.runCombatSequence(720, (progress) => {
                this.drawCombatFrame();
                const ctx = this.battleCtx;
                const alpha = Math.sin(progress * Math.PI);
                ctx.save();
                ctx.translate(150, 200);
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = COLORS.teal;
                ctx.lineWidth = 6;
                ctx.strokeRect(-16, -58, 32, 116);
                ctx.strokeRect(-58, -16, 116, 32);
                ctx.strokeStyle = COLORS.cyan;
                ctx.lineWidth = 2;
                ctx.strokeRect(-25 - progress * 25, -67 - progress * 25, 50 + progress * 50, 134 + progress * 50);
                ctx.restore();
                this.drawSequenceLabel('FIELD_REPAIR', progress, COLORS.teal);
            });
        };

        proto.animateCounter = function() {
            this.runCombatSequence(620, (progress) => {
                this.drawCombatFrame();
                const ctx = this.battleCtx;
                ctx.save();
                ctx.translate(150, 200);
                ctx.globalAlpha = Math.sin(progress * Math.PI);
                ctx.strokeStyle = COLORS.yellow;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(0, 0, 62, -Math.PI * 0.25, Math.PI * 1.25);
                ctx.stroke();
                ctx.fillStyle = COLORS.yellow;
                ctx.beginPath();
                ctx.moveTo(-49, -42);
                ctx.lineTo(-72, -46);
                ctx.lineTo(-59, -25);
                ctx.fill();
                ctx.restore();
                this.drawSequenceLabel('COUNTER.ARMED', progress, COLORS.navy);
            });
        };

        proto.animateBonklerBeam = function() {
            const sourceX = 150;
            const targetX = 650;
            let fired = false;
            this.runCombatSequence(1120, (progress, elapsed) => {
                this.drawCombatFrame();
                const ctx = this.battleCtx;
                const charge = clamp(progress / 0.32);

                if (progress < 0.38) {
                    for (let ring = 0; ring < 4; ring++) {
                        ctx.save();
                        ctx.globalAlpha = 0.9 - ring * 0.17;
                        ctx.strokeStyle = ring % 2 ? COLORS.cyan : COLORS.blue;
                        ctx.lineWidth = 4;
                        ctx.setLineDash([6, 5]);
                        ctx.beginPath();
                        ctx.arc(sourceX + 52, 200, 72 - charge * 52 + ring * 13, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                if (progress > 0.27) {
                    const beamProgress = easeOut(clamp((progress - 0.27) / 0.28));
                    const beamEnd = sourceX + 45 + (targetX - sourceX - 45) * beamProgress;
                    const width = 18 + Math.sin(elapsed * 0.08) * 6;
                    ctx.save();
                    ctx.globalAlpha = clamp((progress - 0.27) * 5) * clamp((1 - progress) * 4);
                    ctx.fillStyle = COLORS.navy;
                    ctx.fillRect(sourceX + 42, 200 - width, beamEnd - sourceX - 42, width * 2);
                    ctx.fillStyle = COLORS.cyan;
                    ctx.fillRect(sourceX + 42, 200 - width * 0.55, beamEnd - sourceX - 42, width * 1.1);
                    ctx.fillStyle = COLORS.white;
                    ctx.fillRect(sourceX + 42, 196, beamEnd - sourceX - 42, 8);
                    for (let segment = 0; segment < 12; segment++) {
                        const x = sourceX + 58 + segment * 40;
                        if (x > beamEnd) break;
                        ctx.fillStyle = segment % 2 ? COLORS.yellow : COLORS.blue;
                        ctx.fillRect(x, 200 - width - 7, 18, 5);
                        ctx.fillRect(x + 9, 200 + width + 2, 18, 5);
                    }
                    ctx.restore();

                    if (beamProgress > 0.86) {
                        const impact = clamp((progress - 0.5) / 0.5);
                        this.drawTargetReticle(targetX, 200, 35 + impact * 96, 1 - impact, COLORS.yellow);
                        this.drawPixelBurst(targetX, 200, impact, COLORS.cyan, 32, 145);
                        if (!fired) {
                            fired = true;
                            this.pulseArena('special-impact');
                            this.playTone(72, 0.32, 'sawtooth', 0.045);
                        }
                    }
                }
                this.drawSequenceLabel('BONKLER_BEAM', progress, COLORS.blue);
            });
        };
    };
})();
