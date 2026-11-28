(() => {
  const api = window.ClosedLoop;
  const font = (size, weight = 500) => weight + ' ' + size + 'px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';

  function drawRadar(canvas, axes) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ink = getComputedStyle(canvas);
    const color = name => ink.getPropertyValue(name).trim();
    ctx.setTransform(canvas.width / 480,0,0,canvas.height / 350,0,0);
    ctx.clearRect(0,0,480,350);
    paintRadar(ctx,axes,{grid:color('--border2'),accent:color('--accent'),text:color('--text'),muted:color('--muted')});
  }

  function paintRadar(ctx, axes, color) {
    const center = [240,177];
    const step = 22;
    const point = (index, radius) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length;
      return [center[0] + Math.cos(angle) * radius,center[1] + Math.sin(angle) * radius];
    };
    const polygon = points => {
      ctx.beginPath();
      points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.closePath();
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = color.grid;
    for (let i = 1; i <= 5; i++) {
      polygon(axes.map((_,index) => point(index,i * step)));
      ctx.stroke();
    }
    axes.forEach((_,i) => {
      ctx.beginPath();
      ctx.moveTo(...center);
      ctx.lineTo(...point(i,5 * step));
      ctx.stroke();
    });
    polygon(axes.map((axis,i) => point(i,axis.score * step)));
    ctx.fillStyle = color.accent;
    ctx.globalAlpha = .25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    axes.forEach((axis,i) => {
      ctx.beginPath();
      ctx.arc(...point(i,axis.score * step),axis.isPriority ? 4.8 : 3.2,0,Math.PI * 2);
      ctx.fillStyle = color.accent;
      ctx.fill();
      const [x,y] = point(i,147);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = font(21,700);
      ctx.fillStyle = axis.isPriority ? color.accent : color.text;
      ctx.fillText(axis.label,x,y - 1);
      ctx.font = font(19);
      ctx.fillStyle = color.muted;
      ctx.fillText(axis.score + ' / 5',x,y + 24);
    });
  }

  function lines(ctx, value, width) {
    return String(value).split(/\r?\n/).flatMap(paragraph => {
      const rows = [];
      let current = '';
      for (const char of paragraph) {
        if (current && ctx.measureText(current + char).width > width) {
          const opening = current.match(/[（【《「『]+$/u)?.[0];
          const carry = opening || (/[、。，．！？；：）】》」』]/u.test(char) ? Array.from(current).at(-1) : '');
          if (carry && carry.length < current.length) {
            rows.push(current.slice(0,-carry.length).trimEnd());
            current = carry;
          } else {
            rows.push(current.trimEnd());
            current = '';
          }
        }
        if (current || char !== ' ') current += char;
      }
      return [...rows,current];
    });
  }

  function voyageImage(result, voyage, values) {
    const details = api.voyageCardDetails(result,voyage);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('无法生成图片'));
    const width = 1080;
    const inset = 65;
    const contentWidth = width - 2 * inset;
    const paint = [];
    // The saved image uses the signature dark palette in either page theme.
    const background = '#0B0D0F';
    const surface = '#13161A';
    const raised = '#1C2026';
    const border = '#39424B';
    const ink = '#F7F8FA';
    const muted = '#A9B0BA';
    const accent = '#58E1C1';
    let y = 58;
    const text = (value,size,weight,color,margin = 0,padding = 0) => {
      ctx.font = font(size,weight);
      for (const line of lines(ctx,value,contentWidth - 2 * padding)) {
        const top = y;
        const style = ctx.font;
        paint.push(() => {
          ctx.font = style;
          ctx.fillStyle = color;
          ctx.textBaseline = 'top';
          ctx.fillText(line,inset + padding,top);
        });
        y += Math.round(size * 1.44);
      }
      y += margin;
    };
    text('乔不不斯 · 航海实战',27,700,accent,8);
    text(api.voyageCardTitle,59,800,ink,18);
    text(values.name,34,700,ink,4);
    if (values.baselineDate) text('诊断日期 · ' + values.baselineDate,27,500,muted,7);
    text('当前阶段 · ' + details.stage,32,700,accent,23);

    if (result.map.length) {
      text('上船前评分 · 三个月后用同样的标准再测一次',30,700,ink,13);
      const chartTop = y;
      const barPanelWidth = 444;
      const axes = result.map.filter(axis => axis.key !== 'ai');
      paint.push(() => {
        ctx.save();
        ctx.translate(inset + barPanelWidth + 18,chartTop);
        paintRadar(ctx,axes,{grid:border,accent,text:ink,muted});
        ctx.restore();
      });
      for (const axis of result.map) {
        if (axis.key === 'ai') y += 7;
        const top = y;
        paint.push(() => {
          ctx.fillStyle = axis.key === 'ai' ? raised : surface;
          ctx.fillRect(inset,top,barPanelWidth,52);
          ctx.textBaseline = 'middle';
          ctx.font = font(22,700);
          ctx.fillStyle = ink;
          ctx.fillText(axis.key === 'ai' ? 'AI 提效' : axis.label,inset + 12,top + 26);
          const barWidth = 38;
          const scoreColor = axis.score <= 2 ? '#FFA1AC' : axis.score < 5 ? '#F5CA75' : accent;
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i < axis.score ? scoreColor : border;
            ctx.fillRect(inset + 106 + i * (barWidth + 5),top + 20,barWidth,12);
          }
          if (axis.score === 0) { ctx.fillStyle = scoreColor; ctx.fillRect(inset + 106,top + 20,3,12); }
          ctx.textAlign = 'right';
          ctx.fillStyle = scoreColor;
          ctx.fillText(axis.score + ' / 5',inset + barPanelWidth - 12,top + 26);
          ctx.textAlign = 'left';
        });
        y += 57;
      }
      y = Math.max(y,chartTop + 350) + 24;
    }

    const section = (heading, items, highlight = false) => {
      if (!items.length) return;
      text(heading,35,750,accent,10);
      for (const [label,value] of items) {
        const top = y;
        const paintIndex = paint.length;
        const padding = 21;
        y += 14;
        text(label,25,700,highlight ? accent : muted,3,padding);
        text(value,30,500,ink,0,padding);
        y += 13;
        const height = y - top;
        paint.splice(paintIndex,0,() => {
          ctx.fillStyle = highlight ? raised : surface;
          ctx.beginPath();
          ctx.roundRect(inset,top,contentWidth,height,10);
          ctx.fill();
        });
        y += 9;
      }
      y += 13;
    };
    section('业务环行动',details.business,true);
    section('航海任务',details.boarding);
    section('AI 提效行动',details.ai);
    if (values.problem) {
      text('最担心或仍有疑问的问题',25,700,muted,5);
      text(values.problem,30,500,ink,16);
    }
    if (values.reference) text('诊断编号 · ' + values.reference,23,500,muted);
    canvas.width = width;
    canvas.height = y + 34;
    ctx.fillStyle = background;
    ctx.fillRect(0,0,width,canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0,0,width,8);
    paint.forEach(draw => draw());
    return new Promise((resolve,reject) => canvas.toBlob(blob =>
      blob ? resolve(blob) : reject(new Error('无法编码图片')),'image/png'));
  }

  Object.assign(api,{drawRadar,voyageImage});
})();
