/* ============================================================
   POLICY MINI COURSE - content
   ------------------------------------------------------------
   SOURCE: FSMVU English Preparatory Program, "AI Use Guidelines
   for Students" (official bilingual handbook, 2025). The Turkish
   lesson texts use the handbook's own Turkish version.

   Format reference:
   - Every visible text is bilingual: { en: '...', tr: '...' }.
   - module  = { id, icon, title, lessons[], quiz[] }
       lesson = { title: {en,tr}, body: {en,tr} }  (\n\n = new paragraph)
       quiz q = { q: {en,tr}, options: [{en,tr} x4], answer: <index> }
   - config: maxWrong 2 (more than 2 wrong = fail),
             banHours 48 (second fail of the same test = locked 48h).
   ============================================================ */
(function () {
  'use strict';

  window.POLICY_COURSE = {
    id: 'ai-guidelines-v1',
    title: { en: 'AI Use Guidelines', tr: 'Yapay Zekâ Kullanım Kuralları' },
    intro: {
      en: 'Learn how artificial intelligence may and may not be used in the English Preparatory Program. Pass each module quiz to unlock the next. Pass the final exam to earn your certificate.',
      tr: 'İngilizce Hazırlık Programında yapay zekânın nasıl kullanılıp kullanılamayacağını öğrenin. Bir sonraki modülün açılması için her modül sınavını geçin. Sertifikanızı kazanmak için final sınavını geçin.'
    },
    config: {
      maxWrong: 2,
      banHours: 48
    },

    modules: [

      /* ───────────── MODULE 1: Purpose + Coursework rules ───────────── */
      {
        id: 'm1',
        icon: '🎯',
        title: { en: 'Module 1 · Purpose and Rules of AI Use', tr: 'Modül 1 · YZ Kullanımının Amacı ve Kuralları' },
        lessons: [
          {
            title: { en: 'Why AI is allowed at all', tr: 'YZ neden kullanılabilir' },
            image: { url: '/Images/b475283f-6be9-4976-8474-ba8b943f5761.jpg', caption: { en: 'FSM English Preparatory Program · Educational Technologies and AI Unit', tr: 'FSM İngilizce Hazırlık Programı · Eğitim Teknolojileri ve YZ Birimi' } },
            video: 'https://www.youtube.com/watch?v=8GrXXnSIEmQ',
            body: {
              en: 'The use of artificial intelligence (AI) in the English Preparatory Program aims to support and enhance student learning while upholding academic integrity and ethical standards.\n\nAI tools are intended to assist learning, not replace individual effort. They may be used for generating ideas, practising language, or receiving explanations.\n\nThe final responsibility for all submitted work rests with the student.\n\nThese guidelines follow international good practice on responsible AI in education: transparency about AI use, human oversight, and accountability. They reflect frameworks such as the UNESCO Recommendation on the Ethics of Artificial Intelligence and the EU AI Act.',
              tr: 'İngilizce Hazırlık Programında yapay zekâ (YZ) kullanımının amacı, akademik dürüstlük ve etik standartlar korunarak öğrenci öğrenimini desteklemek ve geliştirmektir.\n\nYZ araçları, öğrenmeye yardımcı olmak için kullanılmalı, bireysel çabanın yerine geçmemelidir. Fikir üretmek, dil pratiği yapmak veya açıklama almak amacıyla kullanılabilir.\n\nTeslim edilen tüm çalışmaların nihai sorumluluğu öğrenciye aittir.\n\nBu kurallar, eğitimde sorumlu YZ kullanımına ilişkin uluslararası iyi uygulamaları izler: YZ kullanımında şeffaflık, insan denetimi ve hesap verebilirlik. UNESCO Yapay Zekâ Etiği Tavsiye Kararı ve AB Yapay Zekâ Yasası gibi çerçeveleri yansıtır.'
            }
          },
          {
            title: { en: 'Coursework rules 1 to 4', tr: 'Ders çalışması kuralları 1-4' },
            image: { url: '/Images/4e8fab5e-b8ac-40d3-85dd-6ea2656377d0.jpg', caption: { en: 'Clear rules keep AI a help, not a shortcut.', tr: 'Açık kurallar YZ\'yi kısa yol değil, bir yardımcı olarak tutar.' } },
            body: {
              en: 'Rule 1. Students must use English when interacting with AI tools, except in limited cases where Turkish is necessary for technical or cultural clarification.\n\nRule 2. AI may be used for: generating ideas, brainstorming topics or examples, practising language skills, and receiving grammar explanations.\n\nRule 3. All AI-assisted text, sentences, or ideas used in assessed work must be highlighted and accompanied by an AI Use Note, including the original prompts.\n\nRule 4. If AI provides most of the wording or determines the structure of the work (for example, more than two consecutive sentences or an outline for the full task), it will be considered AI-written. This must be declared in the AI Use Note.',
              tr: 'Kural 1. Teknik veya kültürel açıklama gerektiren sınırlı durumlar dışında, YZ araçlarıyla etkileşimde İngilizce kullanılmalıdır.\n\nKural 2. YZ şu amaçlarla kullanılabilir: fikir üretmek, konu veya örnek beyin fırtınası yapmak, dil becerilerini geliştirmek ve dilbilgisi açıklamaları almak.\n\nKural 3. Değerlendirmeye tabi çalışmalarda kullanılan tüm YZ destekli metin, cümle veya fikirler vurgulanmalı ve orijinal istemleri içeren bir YZ Kullanım Notu ile birlikte sunulmalıdır.\n\nKural 4. Çalışmanın önemli bir kısmının veya yapısının (örneğin, art arda iki cümleden fazla veya tüm görevin taslağı) YZ tarafından sağlanması durumunda, bu çalışma YZ ile yazılmış sayılır. Bu durum YZ Kullanım Notu\'nda belirtilmelidir.'
            }
          },
          {
            title: { en: 'Coursework rules 5 to 8', tr: 'Ders çalışması kuralları 5-8' },
            image: { url: '/Images/1dd19d80-cc1a-4ad3-9dd7-8954a960dece.jpg', caption: { en: 'Keep every prompt and acknowledge every AI-assisted line.', tr: 'Her istemi saklayın ve her YZ destekli satırı belirtin.' } },
            body: {
              en: 'Rule 5. Any sentence where AI provided wording or structure, even if edited, must be acknowledged as AI-assisted.\n\nRule 6. Students must keep all AI prompts and responses used in their work. If these are lost, they must be re-created and labelled "re-created" in the AI Use Note.\n\nRule 7. All submitted work, including AI-assisted parts, is the student\'s responsibility.\n\nRule 8. In group work, AI contributions must be agreed upon before starting, documented in the shared AI Use Note, and attributed to specific members.',
              tr: 'Kural 5. YZ tarafından sağlanan herhangi bir ifade veya yapı, düzenlenmiş olsa bile, YZ destekli olarak belirtilmelidir.\n\nKural 6. Öğrenciler, çalışmalarında kullandıkları tüm YZ istemlerini ve yanıtlarını saklamakla yükümlüdür. Kayıp olması durumunda yeniden oluşturulmalı ve YZ Kullanım Notu\'nda "yeniden oluşturuldu" olarak işaretlenmelidir.\n\nKural 7. Teslim edilen tüm çalışmalar, YZ destekli bölümler dahil, öğrencinin sorumluluğundadır.\n\nKural 8. Grup çalışmalarında YZ katkıları başlamadan önce kararlaştırılmalı, ortak YZ Kullanım Notu\'nda belgelenmeli ve ilgili üyelere atanmalıdır.'
            }
          }
        ],
        quiz: [
          {
            q: { en: 'Which language should you normally use with AI tools?', tr: 'YZ araçlarıyla normalde hangi dili kullanmalısınız?' },
            options: [
              { en: 'English, with Turkish only for technical or cultural clarification', tr: 'İngilizce; Türkçe yalnızca teknik veya kültürel açıklama için' },
              { en: 'Turkish for every interaction, and English only inside direct quotations', tr: 'Her etkileşimde Türkçe, İngilizce yalnızca doğrudan alıntıların içinde' },
              { en: 'English for prompts, Turkish for the answers', tr: 'İstemler için İngilizce, yanıtlar için Türkçe' },
              { en: 'Whichever language is fastest to type', tr: 'Yazması en hızlı olan dil hangisiyse' }
            ],
            answer: 0
          },
          {
            q: { en: 'Which of these is an allowed use of AI in coursework?', tr: 'Aşağıdakilerden hangisi ders çalışmasında YZ\'nin izin verilen kullanımıdır?' },
            options: [
              { en: 'Brainstorming ideas and examples', tr: 'Fikir ve örnek beyin fırtınası yapmak' },
              { en: 'Producing the final text you submit', tr: 'Teslim ettiğiniz nihai metni üretmek' },
              { en: 'Answering questions during a test', tr: 'Sınav sırasında soruları yanıtlamak' },
              { en: 'Replacing your own draft entirely', tr: 'Kendi taslağınızın tamamen yerine geçmek' }
            ],
            answer: 0
          },
          {
            q: { en: 'What must an AI Use Note include?', tr: 'Bir YZ Kullanım Notu neyi içermelidir?' },
            options: [
              { en: 'The original prompts you used', tr: 'Kullandığınız orijinal istemleri' },
              { en: 'A word count of the AI text', tr: 'YZ metninin kelime sayısını' },
              { en: 'The name of the AI tool only', tr: 'Yalnızca YZ aracının adını' },
              { en: 'Your estimated final grade', tr: 'Tahmini final notunuzu' }
            ],
            answer: 0
          },
          {
            q: { en: 'When is work counted as "AI-written"?', tr: 'Bir çalışma ne zaman "YZ ile yazılmış" sayılır?' },
            options: [
              { en: 'When AI gives more than two consecutive sentences or the task outline', tr: 'YZ art arda ikiden fazla cümle veya görev taslağı verdiğinde' },
              { en: 'When AI corrects one spelling mistake or rewrites a sentence for clarity', tr: 'YZ bir yazım hatasını düzelttiğinde veya bir cümleyi netlik için yeniden yazdığında' },
              { en: 'When AI suggests one synonym for a word', tr: 'YZ bir kelime için tek bir eşanlamlı önerdiğinde' },
              { en: 'When AI explains a grammar rule to you', tr: 'YZ size bir dilbilgisi kuralını açıkladığında' }
            ],
            answer: 0
          },
          {
            q: { en: 'You edited a sentence that AI wrote. What is the rule?', tr: 'YZ\'nin yazdığı bir cümleyi düzenlediniz. Kural nedir?' },
            options: [
              { en: 'It still counts as AI-assisted and must be declared', tr: 'Yine de YZ destekli sayılır ve belirtilmelidir' },
              { en: 'It becomes completely your own work and needs no AI note', tr: 'Tamamen sizin çalışmanız olur ve YZ notuna gerek kalmaz' },
              { en: 'Only the unedited parts must be declared', tr: 'Sadece düzenlenmemiş kısımlar belirtilmelidir' },
              { en: 'It no longer belongs in the AI Use Note', tr: 'Artık YZ Kullanım Notu\'na ait değildir' }
            ],
            answer: 0
          },
          {
            q: { en: 'You deleted the prompts you used with AI. You should...', tr: 'YZ ile kullandığınız istemleri sildiniz. Şunu yapmalısınız...' },
            options: [
              { en: 're-create them and label them "re-created"', tr: 'yeniden oluşturup "yeniden oluşturuldu" olarak işaretlemek' },
              { en: 'leave that part of the note blank', tr: 'notun o kısmını boş bırakmak' },
              { en: 'submit the work without the note', tr: 'çalışmayı notsuz teslim etmek' },
              { en: 'copy a classmate\'s prompts and submit them as your own', tr: 'bir arkadaşın istemlerini kopyalayıp kendinizinmiş gibi sunmak' }
            ],
            answer: 0
          }
        ]
      },

      /* ───────────── MODULE 2: The 8 AI Promises ───────────── */
      {
        id: 'm2',
        icon: '🤝',
        title: { en: 'Module 2 · Your 8 AI Promises', tr: 'Modül 2 · 8 YZ Sözünüz' },
        lessons: [
          {
            title: { en: 'Promises 1 to 4', tr: 'Sözler 1-4' },
            image: { url: '/Images/Slide3.JPG', caption: { en: 'Keep your own voice and learn, do not take shortcuts.', tr: 'Kendi sesinizi koruyun ve öğrenin; kısa yola sapmayın.' } },
            body: {
              en: 'Promise 1. AI can help me but will not create most of my work.\n\nPromise 2. I will keep my own voice and style.\n\nPromise 3. I will use AI to learn, not to take shortcuts.\n\nPromise 4. I am responsible for all work I submit.',
              tr: 'Söz 1. YZ bana yardımcı olabilir ancak çalışmamın çoğunu üretmeyecek.\n\nSöz 2. Kendi sesimi ve tarzımı koruyacağım.\n\nSöz 3. YZ\'yi öğrenmek için kullanacağım, kısa yol olarak değil.\n\nSöz 4. Teslim ettiğim tüm çalışmalardan ben sorumluyum.'
            }
          },
          {
            title: { en: 'Promises 5 to 8', tr: 'Sözler 5-8' },
            image: { url: '/Images/Slide1.JPG', caption: { en: 'You are responsible for all the work you submit.', tr: 'Teslim ettiğiniz tüm çalışmalardan siz sorumlusunuz.' } },
            body: {
              en: 'Promise 5. I will state clearly when I use AI and include the prompts.\n\nPromise 6. Claiming AI\'s work as my own is plagiarism.\n\nPromise 7. I will write my own draft first and receive assistance with AI afterwards.\n\nPromise 8. I will think critically about AI suggestions and decide what to keep.',
              tr: 'Söz 5. YZ kullandığımda bunu açıkça belirtecek ve istemleri ekleyeceğim.\n\nSöz 6. YZ\'nin çalışmasını kendime mal etmek intihaldir.\n\nSöz 7. Önce kendi taslağımı yazacağım ve sonrasında yapay zekâdan yardım alacağım.\n\nSöz 8. YZ önerilerini eleştirel olarak değerlendirecek ve neyin kalacağına ben karar vereceğim.'
            }
          }
        ],
        quiz: [
          {
            q: { en: 'How much of your work may AI create?', tr: 'Çalışmanızın ne kadarını YZ üretebilir?' },
            options: [
              { en: 'Not most of it; the work stays mine', tr: 'Çoğunu değil; çalışma benim kalır' },
              { en: 'Most of it, if I edit afterwards', tr: 'Çoğunu, sonradan düzenlersem' },
              { en: 'The parts I find too difficult', tr: 'Zor bulduğum kısımları' },
              { en: 'My whole first draft', tr: 'Tüm ilk taslağımı' }
            ],
            answer: 0
          },
          {
            q: { en: 'Whose voice and style should your submitted work keep?', tr: 'Teslim ettiğiniz çalışma kimin sesini ve tarzını korumalıdır?' },
            options: [
              { en: 'My own voice and style', tr: 'Kendi sesimi ve tarzımı' },
              { en: 'The AI\'s polished style', tr: 'YZ\'nin parlak tarzını' },
              { en: 'A model essay\'s style', tr: 'Örnek bir makalenin tarzını' },
              { en: 'My teacher\'s writing style', tr: 'Öğretmenimin yazım tarzını' }
            ],
            answer: 0
          },
          {
            q: { en: 'Claiming AI\'s work as your own is...', tr: 'YZ\'nin çalışmasını kendinize mal etmek...' },
            options: [
              { en: 'plagiarism', tr: 'intihaldir' },
              { en: 'acceptable time-saving', tr: 'kabul edilebilir bir zaman tasarrufudur' },
              { en: 'allowed with a note', tr: 'bir notla serbesttir' },
              { en: 'fine for drafts only', tr: 'sadece taslaklar için uygundur' }
            ],
            answer: 0
          },
          {
            q: { en: 'In what order should you work (promise 7)?', tr: 'Hangi sırayla çalışmalısınız (Söz 7)?' },
            options: [
              { en: 'My own draft first, AI help afterwards', tr: 'Önce kendi taslağım, sonra YZ yardımı' },
              { en: 'AI draft first, then I edit it', tr: 'Önce YZ taslağı, sonra ben düzenlerim' },
              { en: 'AI and I take turns writing alternate paragraphs', tr: 'YZ ve ben sırayla, dönüşümlü olarak paragraf yazarız' },
              { en: 'AI outlines, then I fill it in', tr: 'YZ taslak çıkarır, sonra ben doldururum' }
            ],
            answer: 0
          },
          {
            q: { en: 'What should you do with AI\'s suggestions (promise 8)?', tr: 'YZ\'nin önerileriyle ne yapmalısınız (Söz 8)?' },
            options: [
              { en: 'Judge each one and decide what to keep', tr: 'Her birini değerlendirip neyin kalacağına karar vermek' },
              { en: 'Accept every suggestion as correct', tr: 'Her öneriyi doğru kabul etmek' },
              { en: 'Reject every suggestion on principle', tr: 'İlke olarak her öneriyi reddetmek' },
              { en: 'Pass the suggestions to the teacher', tr: 'Önerileri öğretmene iletmek' }
            ],
            answer: 0
          }
        ]
      },

      /* ───────────── MODULE 3: Quick answers + group work ───────────── */
      {
        id: 'm3',
        icon: '💬',
        title: { en: 'Module 3 · Quick Answers and Group Work', tr: 'Modül 3 · Hızlı Cevaplar ve Grup Çalışması' },
        lessons: [
          {
            title: { en: 'Quick answers: essays, grammar, tests', tr: 'Hızlı cevaplar: makale, dilbilgisi, sınavlar' },
            image: { url: '/Images/Slide4.JPG', caption: { en: 'AI can help you brainstorm, but the final writing must be yours.', tr: 'YZ beyin fırtınasında yardımcı olabilir, ancak nihai metin size ait olmalıdır.' } },
            body: {
              en: 'Can AI write my whole essay? No. This will result in a grade of 0 and a warning.\n\nCan AI fix my grammar? No, but it may explain grammar if acknowledged in the AI Use Note.\n\nForgot to declare AI use? The work will not be graded until it is declared.\n\nCan I use AI in a test? No. Tests must show your own ability. Violation results in grade 0 and a warning.\n\nCan AI help me brainstorm? Yes, but the final writing must be mine.',
              tr: 'YZ tüm makalemi yazabilir mi? Hayır. Bu durum 0 not ve uyarı ile sonuçlanır.\n\nYZ dilbilgimi düzeltebilir mi? Hayır, ancak YZ Kullanım Notu\'nda belirtilirse dilbilgisini açıklayabilir.\n\nYZ kullanımı bildirilmedi mi? Bildirilene kadar çalışma notlandırılmaz.\n\nSınavda YZ kullanabilir miyim? Hayır. Sınavlar kendi yeteneğinizi göstermelidir. İhlal durumunda 0 not ve uyarı verilir.\n\nYZ bana fikir verebilir mi? Evet, ancak nihai metin bana ait olmalıdır.'
            }
          },
          {
            title: { en: 'Quick answers: problems and practice', tr: 'Hızlı cevaplar: sorunlar ve pratik' },
            image: { url: '/Images/11ea79f6-6fdb-4e77-beeb-3ddc32892b7c.jpg', caption: { en: 'FSMVU Digital Policy & Ethics Archive.', tr: 'FSMVÜ Dijital Politika ve Etik Arşivi.' } },
            body: {
              en: 'Can I use AI in group work? Yes, but AI input must be documented, with initials showing who edited what.\n\nAI said something offensive or inappropriate? Do not use it. Inform your instructor immediately.\n\nLost your AI prompts? Re-create them and label them "re-created" in the AI Use Note.\n\nCan I practice with AI? Yes, but AI-generated text cannot be submitted for grading.',
              tr: 'Grup çalışmasında YZ kullanılabilir mi? Evet, ancak YZ girdisi belgelenmeli ve kimin hangi kısmı düzenlediği baş harflerle belirtilmelidir.\n\nYZ uygunsuz veya saldırgan bir şey mi söyledi? Kullanmayın. Hemen öğretim görevlisine bildirin.\n\nYZ istemlerini mi kaybettiniz? Yeniden oluşturun ve YZ Kullanım Notu\'nda "yeniden oluşturuldu" olarak işaretleyin.\n\nYZ ile pratik yapabilir miyim? Evet, ancak YZ tarafından üretilen metin notlandırılacak çalışma olarak sunulamaz.'
            }
          },
          {
            title: { en: 'Group work with AI', tr: 'Grup çalışmalarında YZ' },
            image: { url: '/Images/Slide2.JPG', caption: { en: 'In group work, document who used AI for what.', tr: 'Grup çalışmasında kimin neyi YZ ile yaptığını belgeleyin.' } },
            body: {
              en: 'Before starting, teams must agree on how AI will be used.\n\n1. A single shared AI Use Note must be submitted, with initials marking each member\'s contribution.\n\n2. Every member must write a short "learning line" describing their use of AI (for example: "I asked AI for connectors; rewrote three sentences").\n\n3. All prompts and AI responses must be kept.\n\n4. If a member cannot explain AI-generated content, the grade may be adjusted.\n\n5. Repeated denial of AI use will result in a group review and penalties under the Academic Integrity Policy.',
              tr: 'Başlamadan önce ekipler, YZ\'nin nasıl kullanılacağı konusunda anlaşmalıdır.\n\n1. Tek bir ortak YZ Kullanım Notu teslim edilmeli ve her üyenin katkısı baş harfleriyle belirtilmelidir.\n\n2. Her üye, YZ\'yi nasıl kullandığını açıklayan kısa bir "öğrenme satırı" yazmalıdır (örnek: "Bağlaçlar için YZ\'ye sordum; üç cümleyi yeniden yazdım").\n\n3. Tüm istemler ve YZ yanıtları saklanmalıdır.\n\n4. Bir üye, YZ tarafından üretilen içeriği açıklayamazsa not değiştirilebilir.\n\n5. YZ kullanımını sürekli inkâr etmek, grup incelemesine ve Akademik Dürüstlük Politikası kapsamında yaptırımlara yol açar.'
            }
          }
        ],
        quiz: [
          {
            q: { en: 'Can AI write your whole essay for grading?', tr: 'YZ, notlandırılmak üzere tüm makalenizi yazabilir mi?' },
            options: [
              { en: 'No; it scores 0 and brings a warning', tr: 'Hayır; 0 alır ve uyarı getirir' },
              { en: 'Yes, if you shorten it afterwards', tr: 'Evet, sonradan kısaltırsanız' },
              { en: 'Yes, for low-weighted tasks', tr: 'Evet, düşük ağırlıklı görevlerde' },
              { en: 'Yes, if you name the AI tool', tr: 'Evet, YZ aracını belirtirseniz' }
            ],
            answer: 0
          },
          {
            q: { en: 'Can you use AI during a test?', tr: 'Sınav sırasında YZ kullanabilir misiniz?' },
            options: [
              { en: 'No; tests must show your own ability', tr: 'Hayır; sınavlar kendi yeteneğinizi göstermelidir' },
              { en: 'Yes, but only for the hardest questions on the test', tr: 'Evet, ancak yalnızca testteki en zor sorularda' },
              { en: 'Yes, if you add an AI Use Note', tr: 'Evet, bir YZ Kullanım Notu eklerseniz' },
              { en: 'Yes, for spelling checks only', tr: 'Evet, sadece yazım denetiminde' }
            ],
            answer: 0
          },
          {
            q: { en: 'You forgot to declare your AI use. What happens?', tr: 'YZ kullanımını bildirmeyi unuttunuz. Ne olur?' },
            options: [
              { en: 'It is not graded until you declare it', tr: 'Siz bildirene kadar notlandırılmaz' },
              { en: 'The grade simply drops by ten percent automatically', tr: 'Not otomatik olarak yüzde on oranında düşer' },
              { en: 'Nothing about the grade changes', tr: 'Notla ilgili hiçbir şey değişmez' },
              { en: 'The deadline is extended for you', tr: 'Teslim tarihi sizin için uzatılır' }
            ],
            answer: 0
          },
          {
            q: { en: 'AI gives an offensive or inappropriate answer. You should...', tr: 'YZ uygunsuz veya saldırgan bir yanıt verdi. Şunu yapmalısınız...' },
            options: [
              { en: 'not use it and tell your instructor', tr: 'kullanmamak ve öğretim görevlinize söylemek' },
              { en: 'use it but soften the wording', tr: 'kullanmak ama ifadeyi yumuşatmak' },
              { en: 'report it to the AI company', tr: 'YZ şirketine bildirmek' },
              { en: 'share it so others can avoid it', tr: 'başkaları kaçınsın diye paylaşmak' }
            ],
            answer: 0
          },
          {
            q: { en: 'In group work, how is each member\'s contribution marked?', tr: 'Grup çalışmasında her üyenin katkısı nasıl belirtilir?' },
            options: [
              { en: 'With each member\'s initials', tr: 'Her üyenin baş harfleriyle' },
              { en: 'With one signature for the group', tr: 'Grup için tek bir imzayla' },
              { en: 'By word count per member', tr: 'Üye başına kelime sayısıyla' },
              { en: 'The leader alone signs it', tr: 'Yalnızca lider imzalar' }
            ],
            answer: 0
          },
          {
            q: { en: 'A member cannot explain the AI content in the work. What may happen?', tr: 'Bir üye çalışmadaki YZ içeriğini açıklayamıyor. Ne olabilir?' },
            options: [
              { en: 'The grade may be adjusted', tr: 'Not değiştirilebilir' },
              { en: 'The whole group fails automatically', tr: 'Tüm grup otomatik olarak kalır' },
              { en: 'Nothing changes about the grade', tr: 'Notla ilgili hiçbir şey değişmez' },
              { en: 'Only that member is praised', tr: 'Sadece o üye övülür' }
            ],
            answer: 0
          }
        ]
      },

      /* ───────────── MODULE 4: Consequences ───────────── */
      {
        id: 'm4',
        icon: '⚖️',
        title: { en: 'Module 4 · Consequences for Misuse', tr: 'Modül 4 · Yanlış Kullanımın Sonuçları' },
        lessons: [
          {
            title: { en: 'The consequence ladder', tr: 'Yaptırım basamakları' },
            image: { url: '/Images/5e36e217-aace-497a-a2d9-7e20a2e30d9f.jpg', caption: { en: 'Misuse is handled under the FSMVU Academic Integrity Policy.', tr: 'İhlaller FSMVÜ Akademik Dürüstlük Politikası kapsamında değerlendirilir.' } },
            body: {
              en: 'Misuse of AI tools will be handled under the Academic Integrity Policy:\n\n1. First violation: the work is returned for revision or integrity review.\n\n2. Second violation: grade 0 and a written warning.\n\n3. Use of AI in tests: grade 0 and a formal warning; repeat offences lead to an integrity review, probation, or course failure.\n\n4. Serious or repeated misuse: referral to the University Academic Integrity and Discipline Board.',
              tr: 'YZ araçlarının yanlış kullanımı, Akademik Dürüstlük Politikası kapsamında değerlendirilir:\n\n1. İlk ihlal: çalışma revizyon veya dürüstlük incelemesi için iade edilir.\n\n2. İkinci ihlal: 0 not ve yazılı uyarı.\n\n3. Sınavlarda YZ kullanımı: 0 not ve resmi uyarı; tekrarında dürüstlük incelemesi, uyarı veya ders başarısızlığı.\n\n4. Ciddi veya tekrarlanan ihlaller: Üniversite Akademik Dürüstlük ve Disiplin Kurulu\'na sevk edilir.'
            }
          },
          {
            title: { en: 'Remember the essentials', tr: 'Önemli noktaları hatırlayın' },
            image: { url: '/Images/fc21371b-19fd-410a-b60e-441a42c38687.jpg', caption: { en: 'Fatih Sultan Mehmet Vakıf University · English Preparatory Program', tr: 'Fatih Sultan Mehmet Vakıf Üniversitesi · İngilizce Hazırlık Programı' } },
            body: {
              en: 'AI is a learning assistant, never a replacement for your own effort.\n\nDeclare every AI contribution in an AI Use Note with the original prompts, keep your prompts safe, never use AI in tests, and write your own draft first.\n\nFor full disciplinary procedures, see the Academic Integrity Policy section of the student handbook.',
              tr: 'YZ bir öğrenme yardımcısıdır; asla kendi çabanızın yerine geçmez.\n\nHer YZ katkısını orijinal istemlerle birlikte bir YZ Kullanım Notu\'nda bildirin, istemlerinizi saklayın, sınavlarda asla YZ kullanmayın ve önce kendi taslağınızı yazın.\n\nAyrıntılı disiplin prosedürleri için öğrenci el kitabının Akademik Dürüstlük Politikası bölümüne bakınız.'
            }
          }
        ],
        quiz: [
          {
            q: { en: 'What is the outcome of a first violation?', tr: 'İlk ihlalin sonucu nedir?' },
            options: [
              { en: 'The work is returned for revision or review', tr: 'Çalışma revizyon veya inceleme için iade edilir' },
              { en: 'The student immediately fails the entire course', tr: 'Öğrenci anında tüm dersten kalmış sayılır' },
              { en: 'A fine is added to tuition', tr: 'Öğrenim ücretine ceza eklenir' },
              { en: 'The account is suspended for a week', tr: 'Hesap bir hafta askıya alınır' }
            ],
            answer: 0
          },
          {
            q: { en: 'What is the consequence of a second violation?', tr: 'İkinci ihlalin sonucu nedir?' },
            options: [
              { en: 'Grade 0 and a written warning', tr: '0 not ve yazılı uyarı' },
              { en: 'A verbal reminder from the teacher', tr: 'Öğretmenden sözlü bir hatırlatma' },
              { en: 'Extra practice tasks to complete', tr: 'Tamamlanacak ek pratik görevleri' },
              { en: 'A one-week class suspension', tr: 'Bir haftalık sınıf uzaklaştırması' }
            ],
            answer: 0
          },
          {
            q: { en: 'Repeated use of AI in tests can lead to...', tr: 'Sınavlarda tekrarlanan YZ kullanımı şuna yol açabilir...' },
            options: [
              { en: 'an integrity review, probation, or course failure', tr: 'dürüstlük incelemesi, şartlı durum veya ders başarısızlığı' },
              { en: 'a simple make-up test scheduled the following week', tr: 'ertesi hafta için planlanan basit bir telafi sınavı' },
              { en: 'losing ten percent of the grade', tr: 'notun yüzde onunu kaybetme' },
              { en: 'no action after the first warning', tr: 'ilk uyarıdan sonra işlem yapılmaması' }
            ],
            answer: 0
          },
          {
            q: { en: 'Serious or repeated misuse is referred to...', tr: 'Ciddi veya tekrarlanan ihlal şuraya sevk edilir...' },
            options: [
              { en: 'the Academic Integrity and Discipline Board', tr: 'Akademik Dürüstlük ve Disiplin Kurulu\'na' },
              { en: 'the elected student representative council only', tr: 'yalnızca seçilmiş öğrenci temsilcileri konseyine' },
              { en: 'the teacher\'s department head only', tr: 'yalnızca öğretmenin bölüm başkanına' },
              { en: 'the program\'s social committee', tr: 'programın sosyal komitesine' }
            ],
            answer: 0
          },
          {
            q: { en: 'Which policy governs AI misuse?', tr: 'YZ\'nin yanlış kullanımını hangi politika yönetir?' },
            options: [
              { en: 'The Academic Integrity Policy', tr: 'Akademik Dürüstlük Politikası' },
              { en: 'The student attendance policy', tr: 'Öğrenci devam politikası' },
              { en: 'The library lending policy', tr: 'Kütüphane ödünç verme politikası' },
              { en: 'The campus conduct timetable', tr: 'Kampüs davranış çizelgesi' }
            ],
            answer: 0
          }
        ]
      }
    ],

    /* ───────────── FINAL EXAM ───────────── */
    finalExam: {
      title: { en: 'Final Exam', tr: 'Final Sınavı' },
      questions: [
        {
          q: { en: 'Maria used AI to brainstorm and to rephrase two sentences, then edited them. At submission she must...', tr: 'Maria, beyin fırtınası ve iki cümleyi yeniden ifade etmek için YZ kullandı, sonra düzenledi. Teslimde şunu yapmalı...' },
          options: [
            { en: 'highlight those parts and add an AI Use Note with the prompts', tr: 'o kısımları vurgulayıp istemlerle birlikte bir YZ Kullanım Notu eklemek' },
            { en: 'quietly delete the two edited sentences before handing the work in', tr: 'çalışmayı teslim etmeden önce düzenlenen iki cümleyi sessizce silmek' },
            { en: 'do nothing, because she edited them', tr: 'düzenlediği için hiçbir şey yapmamak' },
            { en: 'mention it only if the teacher asks', tr: 'sadece öğretmen sorarsa belirtmek' }
          ],
          answer: 0
        },
        {
          q: { en: 'During a timed writing exam, a student quietly opens an AI app to check grammar. This is...', tr: 'Süreli bir yazma sınavında bir öğrenci dilbilgisi kontrolü için sessizce bir YZ uygulaması açıyor. Bu...' },
          options: [
            { en: 'a violation: grade 0 and a formal warning', tr: 'bir ihlaldir: 0 not ve resmi uyarı' },
            { en: 'allowed, because it is only grammar', tr: 'serbesttir, çünkü sadece dilbilgisi' },
            { en: 'allowed if declared after the exam', tr: 'sınavdan sonra bildirilirse serbesttir' },
            { en: 'a small issue with no consequence', tr: 'yaptırımı olmayan küçük bir konudur' }
          ],
          answer: 0
        },
        {
          q: { en: 'AI-assisted work turns out to contain a factual error. Who is responsible?', tr: 'YZ destekli bir çalışmada olgusal bir hata çıkıyor. Kim sorumludur?' },
          options: [
            { en: 'The student who submitted it', tr: 'Onu teslim eden öğrenci' },
            { en: 'The AI tool that produced it', tr: 'Onu üreten YZ aracı' },
            { en: 'The teacher who set the task', tr: 'Görevi veren öğretmen' },
            { en: 'No one, since AI made the error', tr: 'Hiç kimse, çünkü hatayı YZ yaptı' }
          ],
          answer: 0
        },
        {
          q: { en: 'AI supplied the outline for a student\'s entire essay. Under the rules the work is...', tr: 'YZ, bir öğrencinin tüm makalesinin taslağını sağladı. Kurallara göre çalışma...' },
          options: [
            { en: 'treated as AI-written and must be declared', tr: 'YZ ile yazılmış sayılır ve belirtilmelidir' },
            { en: 'still fully the student\'s own work', tr: 'hâlâ tamamen öğrencinin kendi çalışmasıdır' },
            { en: 'perfectly acceptable as long as you edit it afterwards', tr: 'sonradan düzenlediğiniz sürece tamamen kabul edilebilirdir' },
            { en: 'only a problem if it is graded', tr: 'sadece notlandırılırsa sorundur' }
          ],
          answer: 0
        },
        {
          q: { en: 'A group submits one essay. How should their AI use be recorded?', tr: 'Bir grup tek bir makale teslim ediyor. YZ kullanımları nasıl kaydedilmeli?' },
          options: [
            { en: 'One shared note, initialled per member', tr: 'Üye başına paraflanmış tek ortak not' },
            { en: 'A separate private note from each member', tr: 'Her üyeden ayrı bir özel not' },
            { en: 'Just the group leader signs one note', tr: 'Sadece grup lideri tek bir notu imzalar' },
            { en: 'No note is needed for group work', tr: 'Grup çalışması için nota gerek yoktur' }
          ],
          answer: 0
        },
        {
          q: { en: 'A student deleted the AI chat before submitting. They should...', tr: 'Bir öğrenci teslimden önce YZ sohbetini sildi. Şunu yapmalı...' },
          options: [
            { en: 're-create the prompts and mark them "re-created"', tr: 'istemleri yeniden oluşturup "yeniden oluşturuldu" olarak işaretlemek' },
            { en: 'submit with no prompts attached', tr: 'hiç istem eklemeden teslim etmek' },
            { en: 'ask the AI to recover the old chat', tr: 'YZ\'den eski sohbeti kurtarmasını istemek' },
            { en: 'leave the AI Use Note completely empty this one time', tr: 'bu sefer YZ Kullanım Notu\'nu tamamen boş bırakmak' }
          ],
          answer: 0
        },
        {
          q: { en: 'Which use keeps a human properly in control of the work?', tr: 'Hangi kullanım, çalışmanın kontrolünü gereği gibi insanda tutar?' },
          options: [
            { en: 'AI explains a rule; the student writes the answer', tr: 'YZ bir kuralı açıklar; öğrenci cevabı yazar' },
            { en: 'AI writes the whole answer; the student just submits it', tr: 'YZ tüm cevabı yazar; öğrenci yalnızca teslim eder' },
            { en: 'AI takes the test; the student watches', tr: 'YZ sınava girer; öğrenci izler' },
            { en: 'AI grades the work; the student accepts it', tr: 'YZ çalışmayı puanlar; öğrenci kabul eder' }
          ],
          answer: 0
        },
        {
          q: { en: 'The main reason students must declare AI use is to protect...', tr: 'Öğrencilerin YZ kullanımını bildirmesinin asıl nedeni şunu korumaktır...' },
          options: [
            { en: 'transparency and academic integrity', tr: 'şeffaflık ve akademik dürüstlük' },
            { en: 'the speed of their submissions', tr: 'teslimlerinin hızı' },
            { en: 'the AI company\'s reputation', tr: 'YZ şirketinin itibarı' },
            { en: 'their classmates\' privacy', tr: 'sınıf arkadaşlarının gizliliği' }
          ],
          answer: 0
        },
        {
          q: { en: 'It is a student\'s second AI violation. What is the expected outcome?', tr: 'Bir öğrencinin ikinci YZ ihlali. Beklenen sonuç nedir?' },
          options: [
            { en: 'Grade 0 and a written warning', tr: '0 not ve yazılı uyarı' },
            { en: 'Only the work returned to revise', tr: 'Sadece çalışmanın düzeltmeye iade edilmesi' },
            { en: 'Immediate referral to the discipline board', tr: 'Doğrudan disiplin kuruluna sevk' },
            { en: 'A reminder with no grade change', tr: 'Not değişmeden bir hatırlatma' }
          ],
          answer: 0
        },
        {
          q: { en: 'Which statement best matches the spirit of these guidelines?', tr: 'Hangi ifade bu kuralların ruhuna en uygundur?' },
          options: [
            { en: 'AI assists my learning; the thinking stays mine', tr: 'YZ öğrenmeme yardım eder; düşünme bana aittir' },
            { en: 'AI does the work; I check it looks right', tr: 'YZ işi yapar; ben doğru görünüyor mu bakarım' },
            { en: 'AI is banned from every part of my studies', tr: 'YZ çalışmalarımın her kısmında yasaktır' },
            { en: 'AI use is fine if nobody finds out', tr: 'Kimse öğrenmezse YZ kullanımı sorun değildir' }
          ],
          answer: 0
        }
      ]
    },

    certificate: {
      // {course} and {year} are replaced at render time; the course name
      // prints in bold caps inside the italic statement, like the
      // department's printed Certificate of Participation.
      courseName: { en: 'AI USE GUIDELINES', tr: 'YAPAY ZEKÂ KULLANIM KURALLARI' },
      statement: {
        en: "For having successfully completed the {course} course and passed the final examination in the English Preparatory Programme's {year} academic year.",
        tr: "İngilizce Hazırlık Programı'nın {year} akademik yılında {course} kursunu başarıyla tamamlayıp final sınavını geçtiği için."
      },
      // Official signatories printed across the bottom of the cert.
      signatories: [
        { name: 'Koray TUNÇ', title: { en: 'Head of Department', tr: 'Bölüm Başkanı' } },
        { name: 'Zeynep Bilgehan CAN', title: { en: 'Assistant Head of Department · Academic', tr: 'Bölüm Başkan Yardımcısı · Akademik' } },
        { name: 'Derya ÖZDEMİR', title: { en: 'Program Coordinator', tr: 'Program Koordinatörü' } },
        { name: 'Alireza KABIRI', title: { en: 'EdTech and AI Coordinator', tr: 'Eğitim Teknolojileri ve Yapay Zekâ Koordinatörü' } }
      ]
    }
  };
})();
