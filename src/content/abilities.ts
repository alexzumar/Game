const abilityDefinitions:Record<string,{icon:string;name:string;description:string}>={
 growth:{icon:'⏱️',name:'Скороспелость',description:'Ускоряет собственный рост.'},
 sprout:{icon:'🤝',name:'Дружные всходы',description:'При посадке шанс сразу получить 20% прогресса роста.'},
 bounty:{icon:'💠',name:'Обильный урожай',description:'Шанс удвоить сбор.'},
 pod:{icon:'🎰',name:'Стручок',description:'Шанс получить дополнительно два семени того же вида или линии.'},
 sweet:{icon:'🍭',name:'Сахаристость',description:'Увеличивает цену плодов при продаже.'},
 moisture:{icon:'💧',name:'Запас влаги',description:'Продлевает действие полива.'},
 resistance:{icon:'💪',name:'Устойчивость',description:'Повышает селекционный потенциал при проверке селекции, не меняя генетику.'},
 regrow:{icon:'🔄',name:'Отрастание',description:'Шанс после сбора начать новый цикл без расхода семени.'},
 drought:{icon:'⚓',name:'Крепкий корень',description:'Продолжает расти без воды с долей обычной скорости.'},
 leap:{icon:'🚀',name:'Рывок роста',description:'Каждые 30 секунд влажного роста шанс убрать половину оставшегося времени.'},
 value:{icon:'⏳',name:'Дозревание',description:'Цена растёт после созревания; позже появляется риск гнили.'},
 stability:{icon:'💀',name:'Стабильность',description:'Снижает множитель нарастания риска гнили.'},
 catalyst:{icon:'🧪',name:'Катализатор',description:'Усиливает другие способности, не себя.'},
 sunshine:{icon:'🔥',name:'Теплолюбие',description:'Ускоряет рост в ясную погоду.'},
 head:{icon:'🏋️',name:'Крупный кочан',description:'Повышает размер каждого успеха каскада урожая.'},
 mutation:{icon:'🎲',name:'Изменчивость',description:'Повышает вероятность улучшения генетики потомка.'},
 renew:{icon:'🌀',name:'Возобновление',description:'Шанс после сбора начать новый цикл с половины роста без семени.'},
 cut:{icon:'🥬',name:'Второй срез',description:'Шанс повторно начать рост после сбора.'}
};
for(const [id,ability] of Object.entries(abilityDefinitions))traitNames[id]=ability.icon+' '+ability.name;
