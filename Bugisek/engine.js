/* Dependency-free, DOM-independent rules for a very unfortunate live demo. */
(function(root){
  'use strict';
  const VEHICLES = [
    {id:'van',name:'ALFA 03',short:'A03',symbol:'infantry',branch:'Pěší četa',color:'#4c88a8',speed:6,driver:'1. četa · AČR',route:0},
    {id:'bus',name:'BRAVO 12',short:'B12',symbol:'armor',branch:'Tanková četa',color:'#4c88a8',speed:24,driver:'2. četa · AČR',route:1},
    {id:'truck',name:'CHARLIE 07',short:'C07',symbol:'artillery',branch:'Dělostřelecká četa',color:'#4c88a8',speed:18,driver:'Palebná podpora · AČR',route:2},
    {id:'taxi',name:'DELTA 42',short:'D42',symbol:'reconnaissance',branch:'Průzkumná četa',color:'#4c88a8',speed:12,driver:'Průzkum · AČR',route:3},
    {id:'service',name:'ECHO 01',short:'E01',symbol:'engineer',branch:'Ženijní četa',color:'#4c88a8',speed:10,driver:'Ženijní podpora · AČR',route:4},
    {id:'express',name:'FOXTROT 99',short:'F99',symbol:'signal',branch:'Spojovací četa',color:'#4c88a8',speed:16,driver:'Spojení · AČR',route:5}
  ];
  const MISSIONS = [
    {vehicle:'van',action:'track',title:'„A tady vidíte živá vozidla.“',copy:'Vyber pěší četu <strong>ALFA 03</strong> a zapni sledování. Vojáci AČR chtějí vidět její přesun cvičným terénem.'},
    {plugin:'measure',title:'„Vzdálenosti máme přesné.“',copy:'Otevři <strong>Měření</strong>, vyber dva body na mapě a oprav podezřelé jednotky. Banán není schválená jednotka délky.'},
    {plugin:'draw',title:'„Nakreslíme si trasu.“',copy:'V pluginu <strong>Kreslení</strong> vyznač dva body. Když z trasy vznikne moderní umění, rychle ho vezmi zpět.'},
    {vehicle:'bus',action:'sync',title:'„Data aktualizujeme průběžně.“',copy:'Vyber tankovou četu <strong>BRAVO 12</strong> a obnov GPS šipkou vlevo. „Průběžně“ zatím znamená každé druhé Vánoce.'},
    {plugin:'layers',title:'„Vrstvy? Naprostá samozřejmost.“',copy:'Zapni jednotky v pluginu <strong>Vrstvy</strong>. Pokud se zobrazí něco nepatřičného, obnov pouze jednotky.'},
    {plugin:'maps',title:'„Máme podklady pro každého.“',copy:'V pluginu <strong>Mapy</strong> vyber terénní mapu. Kdyby vedla ke kávovaru, vrať se do cvičného prostoru.'},
    {plugin:'fleet',title:'„Flotilu máme pod kontrolou.“',copy:'V pluginu <strong>Jednotky</strong> načti seznam. Fiktivní posily a plavidla odstraň ověřenou zálohou.'},
    {vehicle:'taxi',action:'track',title:'„A závěrem chytré trasování.“',copy:'Zapni sledování průzkumné čety <strong>DELTA 42</strong>. Ověř její postup lesem a přes polní cesty.'}
  ];
  const PLUGINS = {
    draw:{name:'Kreslení',action:'Nakreslit trasu',fix:'Vzít kresbu zpět',bug:'Trasa překreslila sama sebe na klubko špaget.',pm:'To je optimalizace trasy pro řidiče, kteří nemají kam spěchat.'},
    measure:{name:'Měření',action:'Změřit vzdálenost',fix:'Vrátit jednotky na metry',bug:'Měření převádí metry na banány. Kurz je plovoucí.',pm:'Podporujeme i nestandardní jednotky. Tohle chtěl… někdo určitě.'},
    layers:{name:'Vrstvy',action:'Zobrazit vrstvu jednotek',fix:'Obnovit pouze jednotky',bug:'Vrstva jednotek ukazuje výskyt rozzuřených delfínů.',pm:'To je easter egg od programátorů. Delfíni mají přednost.'},
    maps:{name:'Mapy',action:'Použít terénní mapu',fix:'Vrátit cvičný prostor',bug:'Terénní mapa je teď plán kanceláře. Četa parkuje v kuchyňce.',pm:'Plynulý přechod do indoor navigace. Ano, ta lednice je georeferencovaná.'},
    fleet:{name:'Jednotky',action:'Aktualizovat seznam',fix:'Použít ověřené jednotky',bug:'Sestava obsahuje služební ponorku, židli a ředitelovo ego.',pm:'To jsou virtuální vozidla. Velmi virtuální. Tohle tam minule nebylo.'}
  };
  const INCIDENTS = [
    {id:'gps',title:'GPS právě vstoupila do odborů.',hint:'Jednotky stávkují. Obnov GPS šipkou vlevo.',solution:'sync',duration:8,penalty:19},
    {id:'drift',title:'Mapa si vzala home office.',hint:'Vrať ji zaměřovačem na levé straně.',solution:'center',duration:8,penalty:18},
    {id:'memory',title:'Sledování snědlo všechnu RAM.',hint:'Vyber sledovanou jednotku a zastav sledování.',solution:'stop',duration:9,penalty:21},
    {id:'update',title:'Kritická oprava nekritické opravy.',hint:'Odmítni aktualizaci. Opravdu. Teď není ta chvíle.',solution:'dismiss',duration:9,penalty:23},
    {id:'traffic',title:'Dopravní vrstva začala halucinovat.',hint:'Vypni dopravu tlačítkem vrstev vlevo.',solution:'layers',duration:7,penalty:20}
  ];
  const QUESTIONS = [
    {who:'manager',role:'René Švanda · VELITEL AČR',text:'„A ten restart je taky v ceně, nebo má vlastní licenci?“',answers:[
      {text:'„V ceně. Žádný příplatek. Mezitím si projdeme rozsah dodávky.“',good:true,reply:'Tak mi ukažte ten rozpočet. A žádné překvapení.'},
      {text:'„To je prémiový balíček Dynamická dostupnost.“',good:false,reply:'Za dostupnost už snad platíme?!'},
      {text:'„Cenu vám řekne kolega. Ten, co právě utekl.“',good:false,reply:'Mám mu rovnou zrušit objednávku?'}]},
    {who:'technician',role:'Emil Podržkabel · SPOJAŘ AČR',text:'„To je modrá smrt? Proč mi tvrdíte, že je to dashboard?“',answers:[
      {text:'„To je tmavý režim. Jen hodně modrý.“',good:false,reply:'Na tom dashboardu je napsáno KERNEL_PANIC.'},
      {text:'„Spadl prezentační klient. Data ověřím po obnovení. Ukážu vám architekturu?“',good:true,reply:'Dobře. Nakreslete mi, kde končí klient a začíná server.'},
      {text:'„To způsobuje vaše aura. Máte zapnutý Bluetooth?“',good:false,reply:'Bluetooth nemůže za vaše rozhodnutí.'}]},
    {who:'dispatcher',role:'Jana Rýdlová · OPERÁTORKA C2',text:'„A co mezitím dělají naše jednotky v terénu?“',answers:[
      {text:'„Meditují. Je to součást digitální transformace.“',good:false,reply:'Meditaci nemáme ve smlouvě.'},
      {text:'„Všichni stojí. Až na toho v rybníce.“',good:false,reply:'PROSÍM COŽE?!'},
      {text:'„Jízdy běží dál. Obnovuji zobrazení. Popíšete mi váš ranní provoz?“',good:true,reply:'V šest vyráží první směna. Potřebujeme hlavně přehled.'}]},
    {who:'manager',role:'René Švanda · VELITEL AČR',text:'„Stihnete zprovoznit ukázku, než skončí tahle schůzka?“',answers:[
      {text:'„Počítáme s tím v dalším sprintu. Nebo v dalším životě.“',good:false,reply:'Můj kalendář další život nepodporuje.'},
      {text:'„Potřebuji pár sekund na obnovení. Projdeme zatím priority nasazení.“',good:true,reply:'Priorita jedna: aby to fungovalo. Dvojku si napište sám.'},
      {text:'„Schůzka nemusí skončit. Objednám pizzu na neurčito.“',good:false,reply:'Pizzu si dám. Smlouvu ne.'}]},
    {who:'technician',role:'Emil Podržkabel · SPOJAŘ AČR',text:'„Proč ta aplikace měří trasu v banánech?“',answers:[
      {text:'„Chyba formátování jednotek. Vrátím metry. Jakou přesnost potřebujete?“',good:true,reply:'Na metry. Překvapivě. A chci export bez ovoce.'},
      {text:'„Je to ekologická stopa převedená na svačinu.“',good:false,reply:'Na tomhle projektu bude ekologický hlavně papír po výpovědi.'},
      {text:'„Banán je metr, který se rozhodl nebýt rovný.“',good:false,reply:'Metrologický ústav vám právě zablokoval číslo.'}]},
    {who:'dispatcher',role:'Jana Rýdlová · OPERÁTORKA C2',text:'„Já chci prostě vědět, kde mám četu. Žádné delfíny.“',answers:[
      {text:'„Programátoři tam schovali easter egg. Delfíni se jen nedrželi souřadnic.“',good:false,reply:'Tak jim vyřiďte, že chci jednotky, ne akvárium.'},
      {text:'„Autobus se skryl, protože má sociální úzkost.“',good:false,reply:'Tu teď mám já.'},
      {text:'„Souhlas. Vracím ověřenou flotilu. Které linky jsou pro vás klíčové?“',good:true,reply:'Dvanáctka a sedmička. A ideálně obě na správné souřadnici.'}]}
  ];
  class Game {
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){Object.assign(this,{status:'ready',phase:'tablet',elapsed:0,duration:90,stability:82,trust:76,score:0,completed:0,pluginDemos:0,fixed:0,selected:null,tracked:null,incident:null,repairs:2,clicks:[],nextIncident:11,incidentHistory:[],events:[],traffic:false,bugs:0,pluginBugs:{},activePlugin:null,bsodRemaining:0,room:null,rescues:0,crashes:0,failureReason:'',questionSerial:0});}
    get mission(){return MISSIONS[this.completed%MISSIONS.length];}
    get remaining(){return Math.max(0,this.duration-this.elapsed);}
    emit(type,extra={}){this.events.push({type,...extra});}
    drain(){return this.events.splice(0);}
    start(){if(this.status==='ready'){this.status='playing';this.emit('start');}}
    pause(){if(this.status==='playing'){this.status='paused';if(this.room)this.room.restarting=false;}}
    resume(){if(this.status==='paused')this.status='playing';}
    end(won,reason){if(['won','lost'].includes(this.status))return;this.status=won?'won':'lost';if(reason)this.failureReason=reason;this.emit('end',{won});}
    changeTrust(amount){this.trust=Math.max(0,Math.min(100,this.trust+amount));if(this.trust===0)this.end(false,'Zákazníci ztratili důvěru. Zbyla ti košile, tablet a faktura za catering.');}
    damage(amount,reason){this.stability=Math.max(0,this.stability-amount);if(this.stability===0&&this.phase==='tablet'&&this.status==='playing')this.crash(reason);}
    addBug(reason){this.bugs++;this.changeTrust(-3);if(this.bugs>=3&&this.phase==='tablet'&&this.status==='playing')this.enterRoom(reason,false);}
    crash(reason='Prezentační klient si lehl. Doslova.'){
      if(this.phase!=='tablet'||this.status!=='playing')return;
      this.phase='bsod';this.stability=0;this.bsodRemaining=3.3;this.crashes++;this.failureReason=reason;this.incident=null;this.changeTrust(-12);this.emit('bsod',{reason});
    }
    enterRoom(reason,crashed){
      if(this.status!=='playing')return;
      this.phase='room';this.incident=null;this.activePlugin=null;this.room={remaining:24,progress:0,suspicion:15,cover:0,restarting:false,answered:false,nextQuestion:0,reason,crashed};
      this.newQuestion();this.emit('room-enter',{reason,crashed});
    }
    newQuestion(){
      if(!this.room)return;
      let index=Math.floor(this.random()*QUESTIONS.length);if(index===this.lastQuestion)index=(index+1)%QUESTIONS.length;
      this.lastQuestion=index;this.questionSerial++;this.room.question=QUESTIONS[index];this.room.answered=false;this.room.nextQuestion=7;this.emit('question');
    }
    answer(index){
      if(this.status!=='playing'||this.phase!=='room'||this.room.answered)return;
      const answer=this.room.question.answers[index];if(!answer)return;
      this.room.answered=true;this.room.nextQuestion=4.8;
      if(answer.good){this.room.cover=5.8;this.room.suspicion=Math.max(0,this.room.suspicion-22);this.changeTrust(8);this.score+=45;}
      else{this.room.cover=0;this.room.suspicion=Math.min(95,this.room.suspicion+24);this.changeTrust(-14);}
      this.emit('answer',{...answer,who:this.room.question.who});
    }
    recover(){
      this.phase='tablet';this.rescues++;this.room=null;this.stability=74;this.bugs=0;this.pluginBugs={};this.traffic=false;this.tracked=null;this.selected=null;this.nextIncident=this.elapsed+8+this.random()*5;this.score+=180;this.emit('recovered');this.checkFinish();
    }
    checkFinish(){
      if(this.elapsed<this.duration||this.phase!=='tablet'||this.status!=='playing')return;
      if(this.completed<4||this.pluginDemos<1)this.end(false,'Čas vypršel. Zákazník potřeboval alespoň 4 ukázky, včetně jednoho zkroceného pluginu. Výmluvy samotné se nefakturují.');
      else{this.score+=Math.round(this.trust*4+this.stability*2);this.end(true);}
    }
    tick(dt){
      if(this.status!=='playing')return;dt=Math.min(Math.max(0,dt),.25);this.elapsed=Math.min(this.duration,this.elapsed+dt);
      if(this.phase==='bsod'){this.bsodRemaining-=dt;if(this.bsodRemaining<=0)this.enterRoom(this.failureReason,true);return;}
      if(this.phase==='room'){
        const r=this.room;r.remaining-=dt;r.cover=Math.max(0,r.cover-dt);r.nextQuestion-=dt;this.changeTrust(-dt*.25);
        if(this.status!=='playing')return;
        if(r.restarting){r.progress+=dt*(r.cover>0?24:9);r.suspicion=Math.max(0,Math.min(100,r.suspicion+dt*(r.cover>0?-9:27)));}
        else r.suspicion=Math.max(0,r.suspicion-dt*5);
        if(r.suspicion>=100){r.restarting=false;r.progress=Math.max(0,r.progress-25);r.suspicion=42;this.changeTrust(-22);this.emit('caught');}
        if(this.status!=='playing')return;
        if(r.progress>=100){this.recover();return;}
        if(r.remaining<=0){this.end(false,'PM vysvětloval tak dlouho, až zákazník restartoval výběrové řízení. Aplikace zůstala vypnutá.');return;}
        if(r.nextQuestion<=0)this.newQuestion();return;
      }
      this.damage(dt*(.6+this.elapsed/210+(this.incident ? .35 : 0)), 'RAM došla. Sebevědomí šlo s ní.');
      if(this.phase!=='tablet')return;
      if(this.incident){this.incident.remaining-=dt;if(this.incident.remaining<=0){const bug=this.incident;this.incident=null;this.traffic=false;this.damage(bug.penalty,bug.title);this.addBug(bug.title);this.emit('incident-failed',{incident:bug});}}
      if(this.phase!=='tablet'||this.status!=='playing')return;
      this.checkFinish();if(this.status!=='playing')return;
      if(!this.incident&&this.elapsed>=this.nextIncident)this.spawnIncident();
    }
    spawnIncident(forcedId){
      const pool=INCIDENTS.filter(b=>(b.id!=='memory'||this.tracked)&&b.id!==this.incidentHistory.at(-1));
      const bug=forcedId?INCIDENTS.find(b=>b.id===forcedId):pool[Math.floor(this.random()*pool.length)];if(!bug)return;
      this.incident={...bug,remaining:bug.duration};this.incidentHistory.push(bug.id);this.nextIncident=this.elapsed+12+this.random()*6;if(bug.id==='traffic')this.traffic=true;this.emit('incident',{incident:this.incident});
    }
    complete(){const reward=100+Math.min(100,this.completed*10);this.score+=reward;this.completed++;this.stability=Math.min(100,this.stability+10);this.changeTrust(4);this.emit('mission-complete',{reward});}
    pluginUse(id){
      if(!PLUGINS[id])return;
      this.activePlugin=id;this.pluginBugs[id]=true;this.damage(13+this.random()*9,PLUGINS[id].bug);this.emit('plugin-bug',{id});
      if(this.phase!=='tablet')return;
      if(this.elapsed>15&&this.random()<.09){this.crash('Plugin požádal o paměť. Dostal rozloučení.');return;}
      this.addBug(PLUGINS[id].bug);
    }
    act(action,value){
      if(this.status!=='playing')return;
      if(action==='answer'){this.answer(Number(value));return;}
      if(action==='restart'){if(this.phase==='room'){this.room.restarting=!this.room.restarting;this.emit('restart-toggle');}return;}
      if(this.phase!=='tablet')return;
      if(action==='open-plugin'){if(PLUGINS[value]){this.activePlugin=value;this.emit('plugin-open');}return;}
      if(action==='close-plugin'){this.activePlugin=null;return;}
      this.clicks=this.clicks.filter(t=>this.elapsed-t<1.25);this.clicks.push(this.elapsed);
      if(this.clicks.length>=5){this.clicks=[];this.damage(9,'Klikal jsi rychleji, než stíhá právník psát výluky.');this.emit('spam');if(this.phase!=='tablet')return;}
      if(action==='plugin-use'){this.pluginUse(value);return;}
      if(action==='plugin-fix'){
        if(!this.pluginBugs[value])return;
        delete this.pluginBugs[value];this.bugs=Math.max(0,this.bugs-1);this.fixed++;this.stability=Math.min(100,this.stability+5);this.emit('plugin-fixed',{id:value});
        if(this.mission.plugin===value){this.pluginDemos++;this.complete();}else this.score+=35;return;
      }
      if(action==='select'){if(!VEHICLES.some(v=>v.id===value))return;this.selected=value;this.emit('selected');return;}
      if(action==='deselect'){this.selected=null;return;}
      if(action==='repair'){if(!this.repairs)return;this.repairs--;this.stability=Math.min(100,this.stability+24);this.emit('repair');return;}
      if(action==='install'){this.crash('Aktualizace dokončena. Aplikace také.');return;}
      if(action==='track'&&this.selected===this.tracked)action='stop';
      if(action==='stop')this.tracked=null;
      if(action==='layers')this.traffic=!this.traffic;
      if(this.incident&&action===this.incident.solution&&(action!=='layers'||!this.traffic)){
        const bug=this.incident;this.incident=null;this.fixed++;this.score+=60;this.stability=Math.min(100,this.stability+6);this.emit('incident-fixed',{incident:bug});return;
      }
      if(action==='track'&&this.selected===this.mission.vehicle&&this.incident){this.emit('blocked');return;}
      if(action==='track'&&this.selected)this.tracked=this.selected;
      if(!this.mission.plugin&&this.selected===this.mission.vehicle&&action===this.mission.action){if(this.incident){this.emit('blocked');return;}this.complete();return;}
      if(['center','zoom','layers','stop'].includes(action)){this.damage(1);return;}
      this.damage(action==='empty'?3:8,'Náhodné klikání otevřelo portál do produkce.');this.emit('mistake',{action});
    }
  }
  root.Bugisek={Game,VEHICLES,MISSIONS,PLUGINS,INCIDENTS,QUESTIONS};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.Bugisek;
})(typeof window!=='undefined'?window:globalThis);
