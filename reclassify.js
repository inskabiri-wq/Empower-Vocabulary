const fs = require('fs');
const data = JSON.parse(fs.readFileSync('E:/vocab-trainer/y/datasets.json', 'utf8'));

// ── CONCEPT reclassification rules ──
// Check word + definition against patterns. First match wins.
const conceptRules = [
  // Travel & Tourism
  { sub: 'travel', test: (w,d) => /(trip|journey|travel|tourist|suitcase|holiday|vacation|passport|souvenir|sightseeing|campsite|hostel|cruise|destination|flight|hotel|check.?in|check.?out|unpack|board a|landed|stop.?over|guidebook|accommodation|booking|book hotel|visa)/i.test(w+' '+d) },
  // Transport
  { sub: 'transport', test: (w,d) => /(traffic|bus\b|train\b|car\b|plane|coach|taxi|transport|cycle|drive|parking|car park|bus stop|turbulence|queue|delay|congestion|rush hour|cycle lane)/i.test(w+' '+d) },
  // Money & Finance
  { sub: 'money', test: (w,d) => /(money|salary|price|cash|bank|budget|savings|pay|afford|lend|borrow|spend|cost|discount|bargain|sale|currency|loan|debt|income|investment|grant|account|donate|donation|interest rate|financial|refund|receipt|pounds|poverty)/i.test(w+' '+d) },
  // Education & Learning
  { sub: 'education', test: (w,d) => /(exam|test|lesson|study|studies|school|university|degree|grade|homework|essay|course|student|teacher|mark|revise|education|enrol|fail|pass your|hand in|coaching|certificate|qualification|CV|resume)/i.test(w+' '+d) },
  // Work & Career
  { sub: 'work', test: (w,d) => /(work|job|career|company|training|employ|hire|business|salary|profession|colleague|volunteer|task|apply for|in charge|qualification|manage|administration|marketing|working environment)/i.test(w+' '+d) },
  // Language & Communication
  { sub: 'language', test: (w,d) => /(sentence|vocabulary|adjective|noun|verb|word|alphabet|writing|language|grammar|communicate|message|conversation|express|face to face|put into words|interact|talk|speak|presentation|describe|explain|gossip|article|headline|news|journal|post\b|blog)/i.test(w+' '+d) },
  // Food & Cooking
  { sub: 'food', test: (w,d) => /(food|taste|recipe|menu|cook|eat|meal|dish|portion|ingredient|roast|smoked|chicken|dessert|slice|chop|fry|heat|serve|vending machine|restaurant|delicious)/i.test(w+' '+d) },
  // Technology
  { sub: 'technology', test: (w,d) => /(app\b|browser|social media|digital|online|internet|website|download|email|icon|username|screen|phone|computer|laptop|text message|software|upload|install|connect|log into|charge a|turn off)/i.test(w+' '+d) },
  // Housing & Home
  { sub: 'housing', test: (w,d) => /(flat\b|house|home|furniture|room|accommodation|move house|lock|building|construction|rent|structure|outskirts|urban|resident)/i.test(w+' '+d) },
  // Relationships & Social
  { sub: 'relationship', test: (w,d) => /(relationship|friend|family|trust|community|generation|support|keep in touch|hang out|bring up|grow up|childhood|marriage|married|love|social|laughter|humour|personality|loneliness|lonely)/i.test(w+' '+d) },
  // Health & Body
  { sub: 'health', test: (w,d) => /(health|fitness|disease|illness|injur|cure|ache|medicine|emergency|suffer|allergic|cold\b|temperature|broken leg|keep fit|exercise|workout|shape|symptom|wound|consciousness|faint|pass out|bump|flu)/i.test(w+' '+d) },
  // Environment & Nature
  { sub: 'environment', test: (w,d) => /(environment|climate|pollution|carbon|ecological|atmosphere|solar|energy|nature|river|land|wildlife|endangered|conservation|habitat|warming|weather|reef|preserve|extinct|species)/i.test(w+' '+d) },
  // Crime & Law
  { sub: 'crime', test: (w,d) => /(crime|theft|steal|prison|arrest|evidence|suspect|bribe|broke into|murder|law|trial|sentence|verdict|witness|judge|jury|kidnap|shoplift|burglar|illegal)/i.test(w+' '+d) },
  // Entertainment & Art
  { sub: 'entertainment', test: (w,d) => /(film|movie|music|art|paint|photo|novel|poem|sculpture|drama|exhibition|series|episode|soundtrack|script|puppet|orchestra|concert|album|playlist|shoot|scene|production|instrument|special effect)/i.test(w+' '+d) },
  // Shopping & Products
  { sub: 'shopping', test: (w,d) => /(shop|buy|product|goods|brand|sale|store|market|customer|order|delivery|complaint|exchange|for sale|stock|purchase|in stock|bargain|reasonably priced|send.?back|value)/i.test(w+' '+d) },
  // Sport & Competition
  { sub: 'sport', test: (w,d) => /(sport|team|match|pitch|compete|champion|record|victory|win|tournament|referee|opponent|athletic|score|medal|trophy)/i.test(w+' '+d) },
  // Time & Frequency
  { sub: 'time', test: (w,d) => /(time|temporary|permanent|ever\b|hardly ever|almost always|often|sometimes|never|once|twice|daily|weekly|regular|hour|minute|previous|rush hour|old\b|young|childhood)/i.test(w+' '+d) },
  // Ability & Skills
  { sub: 'ability', test: (w,d) => /(skill|ability|talent|experience|potential|brilliance|determination|goal|aim|achievement|succeed|ambition|creative|confidence|self.?confidence|practice|knowledge|intelligence|capable)/i.test(w+' '+d) },
  // Phrasal verbs & Verb phrases (multi-word expressions)
  { sub: null, test: (w,d) => {
    // Try to extract verb phrase subcategory from multi-word expressions
    const match = w.match(/^(break|bring|call|carry|come|cut|deal|drop|face|fall|figure|get|give|go|grow|hang|have|hold|join|keep|let|lie|live|look|make|move|pass|pay|pick|play|pull|put|reach|run|save|send|set|settle|show|sit|slow|speak|stand|stay|stick|take|tell|throw|turn|use|wait|wake|walk|waste|work|write)\b/i);
    if (match) return 'verb phrase ' + match[1].toLowerCase();
    return null;
  }},
  // Quantity & Amount
  { sub: 'quantity', test: (w,d) => /(amount|half|piece|whole|each|every|how many|how much|several|numerous|extra|pair|lack of|most of)/i.test(w+' '+d) },
  // Feelings & Emotions (not personality but states)
  { sub: 'emotion', test: (w,d) => /(feeling|emotion|hopeful|anxious|grateful|relieved|satisfied|dissatisfied|pleased|surprised|motivated|depressed|depressing|inspiring|bored|boring|annoyed|embarrassed|disappointed|fear|frustrat)/i.test(w+' '+d) },
];

// ── QUALITY reclassification rules ──
const qualityRules = [
  // Emotions/Feelings (adjectives describing how you feel)
  { sub: 'emotion', test: (w,d) => /(bored|excited|tired|happy|sad|worried|proud|relaxed|calm|annoyed|amazed|embarrassed|surprised|shocked|frightened|scared|depressed|miserable|furious|pleased|motivated|boring|exciting|annoying|disappointing|embarrassing|surprising|shocking|frightening|tiring|confusing|terrifying|satisfying|inspiring)/i.test(w) },
  // Personality traits
  { sub: 'personality', test: (w,d) => /(shy|kind|generous|honest|polite|rude|lazy|hardworking|intelligent|careful|careless|talkative|quiet|serious|creative|brave|selfish|sociable|sensible|funny|strict|patient|stubborn|naive|self-confident|ambitious|optimistic|loyal|determined|outgoing|easygoing|adventurous|cautious|reliable|unreliable|irresponsible|unsympathetic|impatient|impolite|dishonest|competitive|sensitive)/i.test(w) },
  // Food qualities
  { sub: 'food quality', test: (w,d) => /(tasty|delicious|roast|smoked|raw|sweet|crunchy|fresh|sour|healthy|unhealthy|home-made)/i.test(w) },
  // Size & Amount
  { sub: 'size', test: (w,d) => /(big|small|huge|tiny|enormous|full|empty|heavy|light|crowded|whole|narrow|thin|chubby|fit\b|long\b|high\b)/i.test(w) },
  // Difficulty
  { sub: 'difficulty', test: (w,d) => /(easy|difficult|hard\b|complicated|simple|challenging|tough|tricky|straightforward|demanding|rigorous|gruelling|arduous|backbreaking|exhausting|punishing|awkward|delicate)/i.test(w) },
  // Safety & Danger
  { sub: 'safety', test: (w,d) => /(dangerous|safe|harmful|harmless|extreme|endangered|protected|rare|attacked|wild)/i.test(w) },
  // Appearance & Beauty
  { sub: 'appearance', test: (w,d) => /(beautiful|ugly|attractive|good-looking|gorgeous|lovely|bright|pale|blind|stunning|exotic|breathtaking|dramatic|impressive|remarkable|superb|astonishing|memorable|extraordinary|magnificent)/i.test(w) },
  // Value judgments (good/bad)
  { sub: 'value', test: (w,d) => /(fantastic|amazing|wonderful|brilliant|perfect|awful|terrible|horrible|incredible|unbelievable|outstanding|dull|interesting|boring|fun\b|useless|useful|effective|precious|great|all right|correct|excellent|superb)/i.test(w) },
  // State / Condition
  { sub: 'state', test: (w,d) => /(married|alive|alone|busy|free|available|common|ordinary|unusual|strange|different|similar|same|modern|traditional|old-fashioned|new|young|famous|popular|special|favourite|necessary|unnecessary|important|previous|regular|next|other|local|basic|essential|genuine|fake|appropriate|random|informal|digital|electronic|independent|international)/i.test(w) },
  // Prefix-based (un-, in-, ir-, dis-, im-)
  { sub: 'negative prefix', test: (w,d) => /^(un|in|ir|dis|im)(experienced|realistic|successful|relevant|fortunate|possible|regular|responsible|polite|patient|legal|honest|competitive|sympathetic|fair)/i.test(w) },
];

// ── REGULAR verb reclassification ──
const regularRules = [
  { sub: 'communication verb', test: (w,d) => /(talk|explain|describe|communicate|complain|respond|reply|admit|accept|refuse|suggest|warn|agree|promise|advise|invite|remind|threaten|recommend|greet|translate|apologise|argue|express|announce|mention|object)/i.test(w) },
  { sub: 'movement verb', test: (w,d) => /(walk|travel|move|arrive|return|hitchhike|commute|explore|escape|enter|attend|dive|struggle|chase|pursue|jump)/i.test(w) },
  { sub: 'creation verb', test: (w,d) => /(create|build|invent|cook|bake|prepare|mix|add|paint|publish|produce|design|develop|compose|perform|brainstorm)/i.test(w) },
  { sub: 'change verb', test: (w,d) => /(improve|increase|decrease|reduce|change|affect|cause|update|repair|destroy|ruin|collapse|deteriorate|revive|preserve|recycle|adapt|install|remove|delete|download|upload|type|browse|press)/i.test(w) },
  { sub: 'mental verb', test: (w,d) => /(decide|imagine|remember|realise|notice|consider|expect|assume|worry|believe|observe|discover|predict|recognise|memorise|understand)/i.test(w) },
  { sub: 'social verb', test: (w,d) => /(share|help|encourage|persuade|employ|hire|donate|celebrate|compete|subscribe|allow|permit|manage|provide|include|offer|prevent|protect|save|rescue|survive|treat|train|raise|admire|represent|cheer)/i.test(w) },
  { sub: 'daily verb', test: (w,d) => /(like|enjoy|watch|play|study|start|finish|use|need|try|stay|hope|prefer|visit|wait|last|seem|want|practise|avoid|miss|rent|afford|binge)/i.test(w) },
  { sub: 'food verb', test: (w,d) => /(chop|fry|mash|serve|squeeze|stir)/i.test(w) },
  { sub: 'crime verb', test: (w,d) => /(kill|murder|steal|burgle|kidnap|shoplift|sentence|owe|search|trap|shoot|hunt)/i.test(w) },
];

let stats = { concept: 0, quality: 0, regular: 0, unmatched_concept: [], unmatched_quality: [], unmatched_regular: [] };

for (const level of Object.keys(data)) {
  data[level].forEach(w => {
    const sc = (w.subcategory || '').toLowerCase().trim();
    const word = w.word || '';
    const def = w.def || '';
    const combo = word + ' ' + def;

    if (sc === 'concept') {
      let matched = false;
      for (const rule of conceptRules) {
        if (rule.sub === null) {
          // Dynamic subcategory (verb phrases)
          const result = rule.test(word, def);
          if (result) {
            w.subcategory = result;
            stats.concept++;
            matched = true;
            break;
          }
        } else if (rule.test(word, def)) {
          w.subcategory = rule.sub;
          stats.concept++;
          matched = true;
          break;
        }
      }
      if (!matched) stats.unmatched_concept.push(level + ': ' + word + ' | ' + def.substring(0,50));
    }

    if (sc === 'quality') {
      let matched = false;
      for (const rule of qualityRules) {
        if (rule.test(word, def)) {
          w.subcategory = rule.sub;
          stats.quality++;
          matched = true;
          break;
        }
      }
      if (!matched) stats.unmatched_quality.push(level + ': ' + word);
    }

    if (sc === 'regular') {
      let matched = false;
      for (const rule of regularRules) {
        if (rule.test(word, def)) {
          w.subcategory = rule.sub;
          stats.regular++;
          matched = true;
          break;
        }
      }
      if (!matched) stats.unmatched_regular.push(level + ': ' + word);
    }
  });
}

console.log('=== Reclassified ===');
console.log('concept:', stats.concept, '/ 683');
console.log('quality:', stats.quality, '/ 332');
console.log('regular:', stats.regular, '/ 301');
console.log('\n=== Still unmatched concept (' + stats.unmatched_concept.length + ') ===');
stats.unmatched_concept.forEach(s => console.log('  ' + s));
console.log('\n=== Still unmatched quality (' + stats.unmatched_quality.length + ') ===');
stats.unmatched_quality.forEach(s => console.log('  ' + s));
console.log('\n=== Still unmatched regular (' + stats.unmatched_regular.length + ') ===');
stats.unmatched_regular.forEach(s => console.log('  ' + s));

// Write the result
fs.writeFileSync('E:/vocab-trainer/y/datasets.json', JSON.stringify(data, null, 2));
console.log('\n✅ datasets.json updated');
