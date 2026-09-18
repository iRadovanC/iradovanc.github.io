(function(){
  'use strict';
  const {Game,VEHICLES,PLUGINS}=window.Bugisek;
  const {routes,routeLengths}=window.BugMap;
  const {symbol:unitSymbol,reactionPoses,layoutMarkers}=window.C2Presentation;
  let reactionSerial=0,mapHovered=false;
  const $=id=>document.getElementById(id), game=new Game();
  const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const markers={},fleet={};
  let zoom=1,animationTime=0,lastFrame=0,renderTime=0,vehicleFrame=0,lastPhase='',lastQuestion=-1,lastPluginKey='';
  let tool=null,points=[],measurement='',toastTimer,bubbleTimer,reactionTimer,best=0,soundOn=false,audioContext,helpPaused=false,nextQuip=7;
  let reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{best=Number(localStorage.getItem('bugisek-demo-best'))||0;soundOn=localStorage.getItem('bugisek-sound')==='true';}catch(_){}
  const quips={
    good:['Vidíte? Přesně takhle to funguje. Prosím, nikdo to nezakřikněte.','Tuhle část nám vývojáři dovolili ukazovat bez dozoru.','Tohle si prosím zapamatujte pro závěrečné hodnocení.','Až se vás někdo zeptá, ano, fungovalo to.'],
    bad:['To je zajímavé. To nám na screenshotu nikdy nedělalo.','Tohle tlačítko je pro pokročilé. Pokročilé v odcházení.','Prosím vás, nefotit. Ty chyby jsou zatím obchodní tajemství.','V pátek to fungovalo. Který pátek, to bych musel zjistit.'],
    fixed:['A vidíte, samoobslužná obnova. Jen jsem jí musel trochu obsloužit.','Tímto jsme otestovali i krizový scénář. Úplně záměrně.','Aplikace je zpátky. Moje tepová frekvence zatím ne.'],
    idle:['To, že se potím, nemá s aplikací nic společného. Je tu agilní klima.','Samozřejmě to umí i offline. Online zatím ladíme.','Fakt moc beta znamená, že máte přednostní přístup k překvapením.','Kdyby něco blikalo, je to interaktivita. Kdyby všechno zhaslo, úspornost.']
  };
  const customerLines={happy:['To už vypadá použitelně.','Naše četa! A není to husa!','Dobře. Tohle si odškrtnu.'],sad:['V rozpočtu mám kolonku „proč“.','Tohle mám vysvětlovat jednotkám?','Tenhle log si schovám.'],angry:['Smlouva má taky tlačítko Zrušit.','Chci jednotky. Ne divadelní soubor.','Tohle není bug. To je celý ekosystém.'],panic:['Neříkejte mi, že je to ostrá verze.','Já to věděla. Já to říkala.','Modrá. Klasika. Aspoň držíte standard.']};
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  function buildVehicles(){VEHICLES.forEach(v=>{
    const marker=document.createElement('button');marker.className='unit-marker';marker.style.setProperty('--vehicle-color',v.color);marker.setAttribute('aria-label',`Vybrat ${v.name}`);marker.title=`${v.name} · ${v.branch} · vlastní jednotka APP-6`;marker.dataset.unit=v.id;marker.innerHTML=`${unitSymbol(v)}<span class="marker-label">${v.short}</span>`;
    marker.addEventListener('click',e=>{e.stopPropagation();if(tool)recordPoint(e);else { game.activePlugin=null;select(v.id); }});$('vehicle-markers').append(marker);markers[v.id]=marker;
    const button=document.createElement('button');button.className='fleet-item';button.dataset.short=v.short;button.style.setProperty('--vehicle-color',v.color);button.setAttribute('aria-label',`Vybrat ${v.name} ze seznamu`);button.innerHTML=`${unitSymbol(v)}<span>${v.name}</span>`;button.addEventListener('click',()=>select(v.id));$('fleet-bar').append(button);fleet[v.id]=button;
  });}
  function select(id){if(game.status==='ready'){game.selected=id;render(true);}else act('select',id);beep('tap');}
  function act(action,value){if(game.status==='ready'){toast('Nejdřív spusť prezentaci. Zákazníci ještě hledají Wi-Fi.');return;}game.act(action,value);handleEvents();render(true);}
  function start(){['result-dialog','pause-dialog'].forEach(id=>{if($(id).open)$(id).close();});game.reset();lastPhase='';lastPluginKey='';lastQuestion=-1;nextQuip=7;reactionSerial=0;clearTimeout(reactionTimer);document.querySelectorAll('.character').forEach(el=>{el.dataset.reaction='neutral';el.classList.remove('happy','sad','angry','panic','speaking');});tool=null;points=[];zoom=1;updateZoom();clearEffects();game.start();$('stage').classList.remove('finished');handleEvents();render(true);initAudio();beep('start');}
  function pause(){if(game.status==='playing'){game.pause();$('pause-dialog').showModal();}else if(game.status==='paused'&&$('pause-dialog').open){$('pause-dialog').close();game.resume();}render(true);}
  // Informational jokes should stay readable; short warnings still make room for the next action.
  function toast(text,bad=false,duration=bad?3400:5000){clearTimeout(toastTimer);$('map-toast').textContent=text;$('map-toast').className=`map-toast visible${bad?' bad':''}`;toastTimer=setTimeout(()=>$('map-toast').classList.remove('visible'),duration);}
  function pmSay(text,mood='potí se profesionálně'){
    $('goblin-quote').textContent=`„${text}“`;
    if(game.phase!=='tablet')return;clearTimeout(bubbleTimer);$('pm-bubble').hidden=false;$('pm-bubble-text').textContent=`„${text}“`;$('pm-bubble-mood').textContent=mood;
    bubbleTimer=setTimeout(()=>$('pm-bubble').hidden=true,6800);
  }
  function setPortrait(expression){$('goblin-portrait').dataset.expression=expression;}
  function idleQuip(){
    setPortrait(game.bugs?'nervous':['smile','sneaky','embarrassed'][Math.floor(game.elapsed/14)%3]);
    pmSay(pick(quips.idle));
  }
  function setPose(pose){
    document.querySelectorAll('.pm-sprite').forEach(el=>el.dataset.pose=pose);
    setPortrait({present:'smile',sweat:'nervous',facepalm:'shocked',explain:'embarrassed',restart:'sneaky',relieved:'relieved'}[pose]||'smile');
  }
  function react(emotion){
    clearTimeout(reactionTimer);
    const poses=reactionPoses(emotion,reactionSerial++);
    ['manager','dispatcher','technician'].forEach((who,i)=>{
      const el=document.querySelector('[data-person="'+who+'"]');
      el.className='character char-'+who+' '+emotion;
      el.dataset.reaction=poses[i];el.style.setProperty('--reaction-delay',i*130+'ms');
      if(customerLines[emotion])el.querySelector('.speech').textContent=customerLines[emotion][i];
    });
    setPose(emotion==='happy'?'relieved':emotion==='panic'?'sweat':emotion==='sad'?'facepalm':'explain');
    reactionTimer=setTimeout(()=>{
      document.querySelectorAll('.character').forEach(el=>{el.classList.remove('happy','sad','angry','panic');if(game.phase!=='room')el.dataset.reaction='neutral';});
      if(game.phase==='tablet')setPose('present');
    },3800);
  }
  function floatScore(n){$('floating-score').textContent=`+${n}`;$('floating-score').classList.remove('animate');void $('floating-score').offsetWidth;$('floating-score').classList.add('animate');}
  function handleEvents(){game.drain().forEach(e=>{
    switch(e.type){
      case 'start':pmSay('Dobrý den. Ukážu vám stabilní aplikaci. Stabilní je zatím hlavně její název.','ještě věří');break;
      case 'mission-complete':floatScore(e.reward);react('happy');beep('good');pmSay(pick(quips.good),'povoluje límeček');break;
      case 'incident':beep('alarm');setPose('sweat');pmSay(pick(quips.bad));break;
      case 'incident-fixed':floatScore(60);beep('good');setPortrait('relieved');pmSay(pick(quips.fixed));break;
      case 'incident-failed':beep('bad');react('angry');toast(`Nevyřešený bug. ${game.bugs}/3. Ještě chvíli a bude se vysvětlovat.`,true);break;
      case 'plugin-bug':beep('bad');setPortrait(e.id==='fleet'?'shocked':e.id==='maps'?'embarrassed':'nervous');pmSay(PLUGINS[e.id].pm);drawPluginEffect(e.id);break;
      case 'plugin-fixed':beep('good');setPortrait('relieved');clearPluginEffect(e.id);toast('Opraveno. Do zápisu dáme „praktická ukázka flexibility“.');break;
      case 'bsod':$('pm-bubble').hidden=true;tool=null;beep('lose');setPose('facepalm');break;
      case 'room-enter':tool=null;react('panic');$('pm-bubble').hidden=true;$('presenter-speech').hidden=true;$('customer-reply').textContent='Odpověz na otázku, odveď pozornost a pak spusť nenápadný restart.';break;
      case 'question':if(game.phase==='room')react('sad');lastQuestion=-1;$('presenter-speech').hidden=true;$('customer-reply').textContent='Zákazník se ptá. Teď není vhodná chvíle vinit jeho Wi-Fi.';break;
      case 'answer':$('customer-reply').textContent=`Zákazník: „${e.reply}“`;react(e.good?'happy':'angry');setPose(e.good?'explain':'sweat');beep(e.good?'good':'bad');document.querySelector(`[data-person="${e.who}"] .speech`).textContent=e.reply;document.querySelector(`[data-person="${e.who}"]`).classList.add('speaking');$('presenter-speech').textContent=e.text;$('presenter-speech').hidden=false;break;
      case 'restart-toggle':setPose(game.room.restarting?'restart':'sweat');break;
      case 'caught':$('customer-reply').textContent='„Vy to tam pod stolem restartujete?!“ −22 % důvěry. Zkus nejdřív odvést pozornost.';react('angry');beep('bad');break;
      case 'recovered':clearEffects();tool=null;lastPluginKey='';zoom=1;updateZoom();floatScore(180);react('happy');beep('good');pmSay('Aplikace pouze na okamžik přenechala prostor mezilidské komunikaci. Pokračujeme.','dýchá. znovu.');break;
      case 'blocked':toast('Nejdřív vyřeš oranžové hlášení. Zákazník si zatím čte smlouvu.',true);break;
      case 'mistake':toast(e.action==='empty'?'Terén zatím neodpovídá. Zkus jednotku nebo plugin.':'Tohle k ukázce nepomohlo. Mrkni do zadání vlevo.',true);setPose('sweat');beep('bad');break;
      case 'spam':toast('Pomaleji. Tablet není žádost o dotaci, nemusíš klikat na všechno.',true);beep('bad');break;
      case 'repair':toast('Server dostal kafe a pochvalu. +24 % stability.');beep('good');break;
      case 'end':finish(e.won);break;
    }
  });}
  function finish(won){
    if(game.score>best){best=game.score;try{localStorage.setItem('bugisek-demo-best',String(best));}catch(_){}}
    $('stage').classList.add('finished');$('pm-bubble').hidden=true;
    $('result-kicker').textContent=won?'ZÁKAZNÍK TLESKÁ. TY HLEDÁŠ DEODORANT.':'VÝBĚROVÉ ŘÍZENÍ SE PRÁVĚ RESTARTOVALO';
    $('result-title').textContent=won?'Demo zachráněno.':'Tak my se vám ozveme.';
    $('result-copy').textContent=won?`Předvedl jsi ${game.completed} ukázek, zachránil ${game.rescues} krizových situací a udržel ${Math.ceil(game.trust)} % důvěry. Košile půjde rovnou do čistírny.`:game.failureReason;
    $('result-score').textContent=game.score.toLocaleString('cs-CZ');$('result-tasks').textContent=game.completed;$('result-survived').textContent=`${game.rescues}×`;
    $('result-rank').textContent=won?'Titul: PM, který to ukecal. Povýšení zatím v betě.':'Titul: Specialista na poučení pro příště.';
    setPose(won?'relieved':'facepalm');beep(won?'win':'lose');if(!$('result-dialog').open)$('result-dialog').showModal();
  }
  function render(force=false){
    const seconds=Math.ceil(game.remaining),m=game.mission,room=game.phase==='room';
    $('goblin-portrait').classList.toggle('portrait-paused',game.status!=='playing');
    $('time-value').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('time-progress').style.width=`${game.remaining/90*100}%`;
    $('shift-state').textContent=game.status==='playing'?{tablet:'ŽIVÉ DEMO',bsod:'MODRÁ SMRT',room:'IMPROVIZUJ'}[game.phase]:{ready:'PŘIPRAVEN?',paused:'PAUZA',won:'POTLESK',lost:'TRAPAS'}[game.status];
    $('score-value').innerHTML=`${game.score.toLocaleString('cs-CZ')}<span> bodů</span>`;$('best-value').innerHTML=`${best.toLocaleString('cs-CZ')}<span> bodů</span>`;
    $('start-button').hidden=game.status!=='ready';$('pause-button').disabled=!['playing','paused'].includes(game.status);
    const stability=Math.ceil(game.stability),trust=Math.ceil(game.trust);
    $('stability-value').innerHTML=`${stability}<span>%</span>`;$('stability-fill').style.width=`${stability}%`;document.querySelector('.stability-meter').setAttribute('aria-valuenow',stability);
    $('trust-value').textContent=`${trust} %`;$('trust-fill').style.width=`${trust}%`;document.querySelector('.trust-meter').setAttribute('aria-valuenow',trust);
    $('bug-count').textContent=`${game.bugs} / 3 nevyřešené bugy`;$('rescue-count').textContent=`${game.rescues}× zachráněno`;
    document.body.classList.toggle('low-stability',stability<60);document.body.classList.toggle('critical-stability',stability<30);document.body.classList.toggle('in-room',room);
    $('stage').classList.toggle('danger',stability<30);$('stability-label').textContent=stability>=70?'Drží na slibu':stability>=40?'Drží na izolepě':stability>0?'Dělá závěť':'Odpočívá v RAM';
    $('stability-caption').textContent=room?'Teď je na řadě stabilita projektového manažera.':'3 nevyřešené bugy = otázky od zákazníků.';
    $('repair-button').disabled=game.status!=='playing'||game.phase!=='tablet'||!game.repairs;$('repair-stock').textContent=`${game.repairs}×`;
    $('mission-count').textContent=room?'SOS':String(game.completed+1).padStart(2,'0');$('mission-title').textContent=room?'„Dejte mi jen chviličku.“':m.title;
    $('mission-description').innerHTML=room?'Reaguj na konkrétní otázku zákazníka. Když se rozpovídá, <strong>nenápadně restartuj aplikaci</strong>. Pozor na podezření.':m.copy;
    $('step-one').innerHTML=`<span>1</span>${room?'Odpověz zákazníkovi':m.plugin?`Otevři ${PLUGINS[m.plugin].name}`:'Vyber jednotku'}`;
    $('step-two').innerHTML=`<span>2</span>${room?'Restartuj pod krytím':m.plugin?'Předveď a naprav':m.action==='track'?'Zapni sledování':'Obnov GPS ↻'}`;
    $('step-one').classList.toggle('done',!room&&(m.plugin?game.activePlugin===m.plugin:game.selected===m.vehicle));
    $('mission-reward').textContent=room?'+180 za záchranu':`+${100+Math.min(100,game.completed*10)} bodů`;$('demo-count').textContent=`${game.completed} / 4 ukázky`;
    if(lastPhase!==game.phase){
      lastPhase=game.phase;$('stage').classList.toggle('room',room);$('tablet-mode').classList.toggle('active',!room);$('room-mode').classList.toggle('active',room);$('world').setAttribute('aria-hidden',String(!room));$('rescue-panel').hidden=!room;$('blue-screen').hidden=game.phase!=='bsod';
      $('tablet').inert=room;document.querySelectorAll('.tablet-status,.map-header,.map-viewport,.fleet-bar,.tablet-footer,.plugin-rail,.plugin-panel').forEach(el=>el.inert=game.phase!=='tablet');if(game.phase!=='tablet')$('pm-bubble').hidden=true;
    }
    VEHICLES.forEach(v=>{for(const el of [markers[v.id],fleet[v.id]]){el.classList.toggle('selected',v.id===game.selected);el.classList.toggle('target',v.id===m.vehicle);el.classList.toggle('tracked',v.id===game.tracked);el.setAttribute('aria-pressed',String(v.id===game.selected));}});
    $('map-selected').hidden=!game.selected||!!tool||!!game.activePlugin;
    if(game.selected){const v=VEHICLES.find(v=>v.id===game.selected);$('selected-name').textContent=v.name;$('map-selected').querySelector('.selected-icon').innerHTML=unitSymbol(v);$('selected-detail').textContent=`${game.incident?.id==='gps'?'???':v.speed} km/h · ${v.branch} · ${v.driver}`;$('track-button').querySelector('span').textContent=game.tracked===game.selected?'Zastavit':'Sledovat';}
    $('incident-banner').hidden=!game.incident;if(game.incident){$('incident-title').textContent=game.incident.title;$('incident-hint').textContent=game.incident.hint;$('incident-time').textContent=Math.ceil(game.incident.remaining);}
    $('bug-dialog').hidden=game.incident?.id!=='update';$('map-world').classList.toggle('drift',game.incident?.id==='drift');$('map-world').classList.toggle('frozen',game.incident?.id==='gps');$('map-world').classList.toggle('glitch',game.incident?.id==='traffic');$('map-world').classList.toggle('traffic',game.traffic);$('layers-button').setAttribute('aria-pressed',String(game.traffic));
    $('connection').querySelector('span:last-child').textContent=game.incident?'Spojeno silou vůle.':'99,9 % optimismu';$('map-status').textContent=game.incident?game.incident.title:game.tracked?`Sleduješ ${VEHICLES.find(v=>v.id===game.tracked).name}. Teď už i zákazník.`:'Data jsou živá. Některá mají vlastní život.';
    $('tracked-route').setAttribute('d',game.tracked?routes[VEHICLES.find(v=>v.id===game.tracked).route].map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '):'');
    renderPlugin(force);if(room)renderRoom();
  }
  function renderRoom(){
    const r=game.room;$('room-time').textContent=Math.ceil(r.remaining);$('reboot-value').textContent=`${Math.floor(r.progress)} %`;$('reboot-fill').style.width=`${r.progress}%`;$('suspicion-value').textContent=`${Math.ceil(r.suspicion)} %`;$('suspicion-fill').style.width=`${r.suspicion}%`;
    $('audience-status').textContent=r.cover>0?`Zákazník se rozpovídal. Krytí ještě ${r.cover.toFixed(1)} s.`:'Zákazníci sledují tvoje ruce.';
    $('reboot-button').classList.toggle('running',r.restarting);$('reboot-button').querySelector('span').textContent=r.restarting?'Přestat sahat na tablet':'Nenápadně restartovat';$('reboot-button').disabled=game.status!=='playing';
    $('restart-hint').textContent=r.cover>0?'Teď! Dívají se na sebe. Restart je rychlý a nenápadný.':r.restarting?'Vidí ti na ruce! Zastav restart nebo odveď pozornost odpovědí.':'Nejdřív je zaujmi odpovědí. Pak se věnuj tabletu.';$('rescue-panel').classList.toggle('covered',r.cover>0);
    if(r.restarting)setPose('restart');
    if(lastQuestion!==game.questionSerial){lastQuestion=game.questionSerial;$('customer-role').textContent=r.question.role;$('customer-question').textContent=r.question.text;$('excuse-options').replaceChildren();r.question.answers.forEach((answer,i)=>{const b=document.createElement('button');b.textContent=answer.text;b.addEventListener('click',()=>act('answer',i));$('excuse-options').append(b);});document.querySelectorAll('.character').forEach(el=>el.classList.toggle('speaking',el.dataset.person===r.question.who));document.querySelector(`[data-person="${r.question.who}"] .speech`).textContent=r.question.text;}
    $('excuse-options').querySelectorAll('button').forEach(b=>b.disabled=r.answered||game.status!=='playing');
  }
  function openPlugin(id){
    tool=null;points=[];if(game.status==='ready'){game.activePlugin=game.activePlugin===id?null:id;}else if(game.activePlugin===id)game.act('close-plugin');else game.act('open-plugin',id);lastPluginKey='';render(true);
  }
  function renderPlugin(force){
    const id=game.activePlugin,bad=!!game.pluginBugs[id];document.querySelectorAll('[data-plugin]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.plugin===id));b.classList.toggle('broken',!!game.pluginBugs[b.dataset.plugin]);});
    $('plugin-panel').hidden=!id||!!tool||game.phase!=='tablet';document.querySelector('.tablet-screen').classList.toggle('plugin-open',!$('plugin-panel').hidden);$('drawing-hint').hidden=!tool;$('map-viewport').classList.toggle('drawing',!!tool);
    if(tool)$('drawing-hint').textContent=`${tool==='draw'?'KRESLENÍ':'MĚŘENÍ'} · klepni na ${points.length?'druhý':'první'} bod mapy`;
    if(!id)return;const key=`${id}:${bad}:${game.selected}:${!!tool}`;if(key===lastPluginKey&&!force)return;lastPluginKey=key;
    const p=PLUGINS[id];$('plugin-title').textContent=p.name;$('plugin-content').replaceChildren();const content=$('plugin-content');
    const desc=document.createElement('p');desc.className=bad?'plugin-error':'plugin-description';desc.textContent=bad?p.bug:{draw:'Navrhněte trasu mezi dvěma body. Inteligentní přichytávání. Inteligenci teprve hledáme.',measure:'Přesné vzdálenosti v jednotkách SI. A občas v jednotkách PROČ.',layers:'Zobrazte na mapě jen to, co potřebujete. Příroda s tím nemusí souhlasit.',maps:'Ověřené mapové podklady. Ověřeno, že jsou to obrázky.',fleet:'Aktuální sestava jednotek AČR. Počet se může lišit podle nálady serveru.'}[id];content.append(desc);
    if(id==='measure'&&bad){const out=document.createElement('strong');out.className='measurement-output';out.textContent=measurement||'−404 banánů ± 1 kokos';content.append(out);}
    if(id==='layers'){const list=document.createElement('div');list.className='plugin-list';list.innerHTML=bad?'<span>✓ Rozzuřené husy (128)</span><span>✓ Smutek projektového manažera</span><span>☐ Jednotky (stydí se)</span>':'<span>✓ Základní mapa</span><span>☐ Jednotky v reálném čase</span><span>☐ Situace v terénu</span>';content.append(list);}
    if(id==='maps'){const list=document.createElement('div');list.className='map-options';list.innerHTML=`<span class="map-swatch ${bad?'office':''}"></span><div><strong>${bad?'Kuchyňka · 2. patro':'Bugovice · terénní mapa'}</strong><small>${bad?'Měřítko 1 : kávovar':'Aktualizace: před velkým třeskem'}</small></div>`;content.append(list);if(!bad){const catalog=document.createElement('div');catalog.className='map-catalog';['Ortofoto · pohled z výšky ega','Turistická · cesta k lednici'].forEach(label=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',()=>act('plugin-use','maps'));catalog.append(b);});content.append(catalog);}}
    if(id==='fleet'){const list=document.createElement('div');list.className='plugin-fleet';if(bad){['Ponorka 404 · hloubka: ano','Kancelářská židle · 120 km/h','Ředitelovo ego · nelze zobrazit'].forEach(s=>{const el=document.createElement('span');el.textContent=s;list.append(el);});}else VEHICLES.forEach(v=>{const b=document.createElement('button');b.innerHTML=`${unitSymbol(v)}${v.name}<small>${v.speed} km/h</small>`;b.addEventListener('click',()=>{game.act('close-plugin');select(v.id);});list.append(b);});content.append(list);}
    const action=document.createElement('button');action.className=bad?'plugin-action fix':'plugin-action';action.textContent=bad?p.fix:p.action;action.addEventListener('click',()=>{
      if(bad){act('plugin-fix',id);return;}if(game.status!=='playing'){act('plugin-use',id);return;}
      if(id==='draw'||id==='measure'){tool=id;points=[];render(true);}else act('plugin-use',id);
    });content.append(action);
    if(id==='maps'&&!bad){const danger=document.createElement('button');danger.className='plugin-experimental';danger.textContent='Zapnout experimentální 3D · bez záruky';danger.addEventListener('click',()=>act('install'));content.append(danger);}
    const foot=document.createElement('small');foot.className='plugin-foot';foot.textContent=bad?'✓ Operace úspěšně provedena špatně.':'✓ Připraveno · co by se mohlo stát';content.append(foot);
  }
  function recordPoint(event){
    if(!tool||game.status!=='playing'||game.phase!=='tablet')return;
    const rect=$('plugin-drawing').getBoundingClientRect();points.push({x:Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000)),y:Math.max(0,Math.min(600,(event.clientY-rect.top)/rect.height*600))});
    $('plugin-drawing').innerHTML=points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#d28549"/>`).join('');
    if(points.length===2){const id=tool;tool=null;measurement=`−${Math.round(Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)*3)} banánů ± 1 kokos`;act('plugin-use',id);}else render(true);
  }
  function drawPluginEffect(id){
    if(id==='draw'){const a=points[0]||{x:230,y:180},b=points[1]||{x:720,y:400};$('plugin-drawing').innerHTML=`<path d="M${a.x} ${a.y} C900 10 0 580 700 100 S50 130 630 470 S850 20 ${b.x} ${b.y}" fill="none" stroke="#c46e53" stroke-width="7" stroke-dasharray="11 6"/><text x="430" y="300" fill="#a7573e" font-size="25">Trasa al dente.</text>`;}
    if(id==='measure'){const a=points[0]||{x:240,y:200},b=points[1]||{x:690,y:430};$('plugin-drawing').innerHTML=`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="#b08731" stroke-width="5" stroke-dasharray="9 5"/><text x="270" y="360" font-size="30" fill="#987a2d">🍌 ${measurement}</text>`;}
    updateMapEffects();
  }
  function updateMapEffects(){const el=$('plugin-map-effect');el.classList.toggle('office-map',!!game.pluginBugs.maps);el.classList.toggle('goose-map',!!game.pluginBugs.layers);el.innerHTML=game.pluginBugs.maps?'<span class="office-label">KUCHYŇKA</span><span class="office-desk">☕<small>Nabíjecí stanice pro PM</small></span><span class="office-wc">WC / krizové porady</span>':game.pluginBugs.layers?'<span class="goose g1">🪿</span><span class="goose g2">🪿</span><span class="goose g3">🪿</span><span class="goose g4">🪿</span><b>VRSTVA: HUSY V REÁLNÉM ČASE</b>':'';}
  function clearPluginEffect(id){if(id==='draw'||id==='measure')$('plugin-drawing').innerHTML='';updateMapEffects();lastPluginKey='';}
  function clearEffects(){setPortrait('smile');$('plugin-drawing').innerHTML='';$('plugin-map-effect').className='plugin-map-effect';$('plugin-map-effect').innerHTML='';$('drawing-hint').hidden=true;$('pm-bubble').hidden=true;}
  function updateVehicles(){
    const offsets=[.2,.27,.55,.42,.25,.08],w=$('map-viewport').clientWidth,h=$('map-viewport').clientHeight;
    if(!w||!h)return;
    const positions=VEHICLES.map((v,i)=>{
      const r=routeLengths[v.route],d=(animationTime*(9+v.speed/5)+r.total*offsets[i])%r.total,s=r.parts.find(p=>d<p.start+p.length)||r.parts.at(-1),t=(d-s.start)/s.length;
      const x=(s.from[0]+(s.to[0]-s.from[0])*t)/1500,y=(s.from[1]+(s.to[1]-s.from[1])*t)/1000;
      return {x:w/2+(x-.5)*w*zoom,y:h/2+(y-.5)*h*zoom};
    });
    const first=markers[VEHICLES[0].id],placed=layoutMarkers(positions,w,h,first.offsetWidth,first.offsetHeight);
    VEHICLES.forEach((v,i)=>{markers[v.id].style.left=placed[i].x+'px';markers[v.id].style.top=placed[i].y+'px';});
    $('marker-leaders').setAttribute('viewBox','0 0 '+w+' '+h);
    $('marker-leaders').innerHTML=placed.map((p,i)=>Math.hypot(p.x-positions[i].x,p.y-positions[i].y)>8?'<path d="M'+positions[i].x+' '+positions[i].y+' L'+p.x+' '+p.y+'"/><circle cx="'+positions[i].x+'" cy="'+positions[i].y+'" r="2"/>':'').join('');
  }
  function updateZoom(){['city-map','route-layer'].forEach(id=>$(id).style.transform=`scale(${zoom})`);updateVehicles();}
  function initAudio(){if(!soundOn)return;try{if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch(_){soundOn=false;updateSound();}}
  function beep(kind){if(!soundOn||!audioContext)return;const patterns={tap:[520],start:[330,440,660],good:[520,660,780],bad:[210,145],alarm:[370,280,370],win:[390,520,660,780,1040],lose:[330,270,180,90]};(patterns[kind]||[440]).forEach((freq,i)=>{const at=audioContext.currentTime+i*.11,o=audioContext.createOscillator(),gain=audioContext.createGain();o.type=kind==='bad'||kind==='alarm'?'triangle':'sine';o.frequency.setValueAtTime(freq,at);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045,at+.01);gain.gain.exponentialRampToValueAtTime(.001,at+.18);o.connect(gain);gain.connect(audioContext.destination);o.start(at);o.stop(at+.2);});}
  function updateSound(){$('sound-button').innerHTML=icon(soundOn?'sound':'mute');const text=soundOn?'Vypnout zvuk':'Zapnout zvuk';$('sound-button').setAttribute('aria-label',text);$('sound-button').title=text;}
  $('start-button').addEventListener('click',start);$('restart-button').addEventListener('click',start);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',pause);$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();pause();});
  $('result-back').addEventListener('click',()=>{$('result-dialog').close();game.reset();tool=null;clearEffects();$('stage').classList.remove('finished');render(true);});$('result-dialog').addEventListener('cancel',e=>{e.preventDefault();$('result-back').click();});
  document.querySelectorAll('[data-plugin]').forEach(b=>b.addEventListener('click',()=>openPlugin(b.dataset.plugin)));$('plugin-close').addEventListener('click',()=>{game.activePlugin=null;tool=null;render(true);});
  $('track-button').addEventListener('click',()=>act('track'));$('sync-button').addEventListener('click',()=>act('sync'));$('repair-button').addEventListener('click',()=>act('repair'));$('dismiss-update').addEventListener('click',()=>act('dismiss'));$('install-update').addEventListener('click',()=>act('install'));$('layers-button').addEventListener('click',()=>act('layers'));$('reboot-button').addEventListener('click',()=>act('restart'));
  $('deselect-button').addEventListener('click',()=>{if(game.status==='ready'){game.selected=null;render(true);}else act('deselect');});$('center-button').addEventListener('click',()=>{zoom=1;updateZoom();act('center');});
  $('zoom-in').addEventListener('click',()=>{zoom=Math.min(1.5,zoom+.15);updateZoom();act('zoom');});$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.9,zoom-.15);updateZoom();act('zoom');});
  $('map-viewport').addEventListener('pointerenter',()=>{mapHovered=true;});$('map-viewport').addEventListener('pointerleave',()=>{mapHovered=false;});
  $('map-viewport').addEventListener('click',e=>{if(e.target.closest('button,.plugin-panel,.map-selected,.bug-dialog,.incident-banner'))return;if(tool)recordPoint(e);else act('empty');});
  $('help-button').addEventListener('click',()=>{helpPaused=game.status==='playing';if(helpPaused)game.pause();$('help-dialog').showModal();render(true);});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));$('help-dialog').addEventListener('close',()=>{if(helpPaused){game.resume();helpPaused=false;render(true);}});
  $('sound-button').addEventListener('click',()=>{soundOn=!soundOn;try{localStorage.setItem('bugisek-sound',String(soundOn));}catch(_){}initAudio();updateSound();beep('tap');});
  $('motion-button').addEventListener('click',()=>{reducedMotion=!reducedMotion;document.body.classList.toggle('reduced-motion',reducedMotion);$('motion-button').setAttribute('aria-pressed',String(reducedMotion));$('motion-button').textContent=reducedMotion?'Zapnout animace':'Omezit animace';});
  $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Celou obrazovku tento prohlížeč nepodporuje.');}catch(_){toast('Prohlížeč celou obrazovku nepovolil.');}});
  document.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;if(e.code==='Space'&&!document.querySelector('dialog[open]')&&e.target.tagName!=='BUTTON'){e.preventDefault();pause();}if(e.key==='Escape'&&tool){tool=null;render(true);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')pause();});
  function frame(now){const dt=Math.min((now-lastFrame)/1000||0,.1);lastFrame=now;if(game.status==='playing'){game.tick(dt);handleEvents();if(game.phase==='tablet'&&game.elapsed>=nextQuip){nextQuip=game.elapsed+14;idleQuip();}}if(!mapHovered&&(game.status==='ready'||game.status==='playing')&&game.phase==='tablet'&&game.incident?.id!=='gps')animationTime+=dt;if(!reducedMotion||now-vehicleFrame>200){updateVehicles();vehicleFrame=now;}if(now-renderTime>100){render();renderTime=now;}requestAnimationFrame(frame);}
  buildVehicles();new ResizeObserver(updateVehicles).observe($('map-viewport'));window.BugMap.draw();updateVehicles();updateSound();render(true);document.body.classList.toggle('reduced-motion',reducedMotion);$('motion-button').setAttribute('aria-pressed',String(reducedMotion));requestAnimationFrame(frame);
})();
