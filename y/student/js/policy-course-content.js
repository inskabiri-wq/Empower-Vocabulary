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
            body: {
              en: 'The use of artificial intelligence (AI) in the English Preparatory Program aims to support and enhance student learning while upholding academic integrity and ethical standards.\n\nAI tools are intended to assist learning, not replace individual effort. They may be used for generating ideas, practising language, or receiving explanations.\n\nThe final responsibility for all submitted work rests with the student.',
              tr: 'İngilizce Hazırlık Programında yapay zekâ (YZ) kullanımının amacı, akademik dürüstlük ve etik standartlar korunarak öğrenci öğrenimini desteklemek ve geliştirmektir.\n\nYZ araçları, öğrenmeye yardımcı olmak için kullanılmalı, bireysel çabanın yerine geçmemelidir. Fikir üretmek, dil pratiği yapmak veya açıklama almak amacıyla kullanılabilir.\n\nTeslim edilen tüm çalışmaların nihai sorumluluğu öğrenciye aittir.'
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
            q: { en: 'Which language must you normally use when interacting with AI tools?', tr: 'YZ araçlarıyla etkileşimde normalde hangi dil kullanılmalıdır?' },
            options: [
              { en: 'English, except limited cases needing Turkish for technical or cultural clarification', tr: 'İngilizce; teknik veya kültürel açıklama gereken sınırlı durumlar hariç' },
              { en: 'Turkish at all times', tr: 'Her zaman Türkçe' },
              { en: 'Any language you prefer', tr: 'İstediğiniz herhangi bir dil' },
              { en: 'Only formal academic English with no exceptions', tr: 'İstisnasız yalnızca resmi akademik İngilizce' }
            ],
            answer: 0
          },
          {
            q: { en: 'Which of these is an ALLOWED use of AI in coursework?', tr: 'Aşağıdakilerden hangisi ders çalışmalarında YZ\'nin İZİN VERİLEN bir kullanımıdır?' },
            options: [
              { en: 'Brainstorming topics or examples', tr: 'Konu veya örnek beyin fırtınası yapmak' },
              { en: 'Writing your whole essay', tr: 'Makalenizin tamamını yazdırmak' },
              { en: 'Answering test questions for you', tr: 'Sınav sorularını sizin yerinize cevaplamak' },
              { en: 'Submitting AI text without declaring it', tr: 'YZ metnini bildirmeden teslim etmek' }
            ],
            answer: 0
          },
          {
            q: { en: 'What must accompany all AI-assisted text in assessed work?', tr: 'Değerlendirmeye tabi çalışmalardaki tüm YZ destekli metinlere ne eşlik etmelidir?' },
            options: [
              { en: 'An AI Use Note including the original prompts', tr: 'Orijinal istemleri içeren bir YZ Kullanım Notu' },
              { en: 'Nothing, if the text is short', tr: 'Metin kısaysa hiçbir şey' },
              { en: 'A verbal mention to a classmate', tr: 'Bir sınıf arkadaşına sözlü olarak söylemek' },
              { en: 'A photo of your screen', tr: 'Ekranınızın bir fotoğrafı' }
            ],
            answer: 0
          },
          {
            q: { en: 'When is work considered AI-written?', tr: 'Bir çalışma ne zaman YZ ile yazılmış sayılır?' },
            options: [
              { en: 'When AI provides more than two consecutive sentences or the outline of the full task', tr: 'YZ art arda iki cümleden fazlasını veya tüm görevin taslağını sağladığında' },
              { en: 'When AI explains one grammar rule', tr: 'YZ tek bir dilbilgisi kuralını açıkladığında' },
              { en: 'When you brainstorm a topic with AI', tr: 'YZ ile bir konu üzerinde beyin fırtınası yaptığınızda' },
              { en: 'Work can never be considered AI-written', tr: 'Bir çalışma asla YZ ile yazılmış sayılmaz' }
            ],
            answer: 0
          },
          {
            q: { en: 'You edited a sentence that AI wrote for you. What is the rule?', tr: 'YZ\'nin sizin için yazdığı bir cümleyi düzenlediniz. Kural nedir?' },
            options: [
              { en: 'It must still be acknowledged as AI-assisted', tr: 'Yine de YZ destekli olarak belirtilmelidir' },
              { en: 'Editing makes it fully your own work', tr: 'Düzenleme onu tamamen sizin çalışmanız yapar' },
              { en: 'You can remove it from the AI Use Note', tr: 'YZ Kullanım Notu\'ndan çıkarabilirsiniz' },
              { en: 'Only the first word needs declaring', tr: 'Sadece ilk kelimenin bildirilmesi gerekir' }
            ],
            answer: 0
          },
          {
            q: { en: 'You lost the AI prompts you used. What must you do?', tr: 'Kullandığınız YZ istemlerini kaybettiniz. Ne yapmalısınız?' },
            options: [
              { en: 'Re-create them and label them "re-created" in the AI Use Note', tr: 'Yeniden oluşturup YZ Kullanım Notu\'nda "yeniden oluşturuldu" olarak işaretlemek' },
              { en: 'Say nothing and hope nobody asks', tr: 'Hiçbir şey söylememek ve kimsenin sormamasını ummak' },
              { en: 'Delete the AI-assisted parts secretly', tr: 'YZ destekli kısımları gizlice silmek' },
              { en: 'Ask a friend to share their prompts', tr: 'Bir arkadaştan istemlerini paylaşmasını istemek' }
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
            q: { en: 'Complete promise 1: "AI can help me but will not..."', tr: 'Söz 1\'i tamamlayın: "YZ bana yardımcı olabilir ancak..."' },
            options: [
              { en: 'create most of my work', tr: 'çalışmamın çoğunu üretmeyecek' },
              { en: 'answer my questions', tr: 'sorularımı cevaplamayacak' },
              { en: 'explain grammar to me', tr: 'bana dilbilgisi açıklamayacak' },
              { en: 'help me brainstorm', tr: 'beyin fırtınasında yardım etmeyecek' }
            ],
            answer: 0
          },
          {
            q: { en: 'Whose voice and style must your submitted work keep?', tr: 'Teslim ettiğiniz çalışma kimin sesini ve tarzını korumalıdır?' },
            options: [
              { en: 'My own', tr: 'Benim kendi sesimi ve tarzımı' },
              { en: 'The AI\'s', tr: 'YZ\'nin' },
              { en: 'My teacher\'s', tr: 'Öğretmenimin' },
              { en: 'A famous writer\'s', tr: 'Ünlü bir yazarın' }
            ],
            answer: 0
          },
          {
            q: { en: 'According to the promises, claiming AI\'s work as your own is...', tr: 'Sözlere göre, YZ\'nin çalışmasını kendinize mal etmek...' },
            options: [
              { en: 'plagiarism', tr: 'intihaldir' },
              { en: 'good time management', tr: 'iyi zaman yönetimidir' },
              { en: 'acceptable if edited', tr: 'düzenlenirse kabul edilebilirdir' },
              { en: 'teamwork', tr: 'takım çalışmasıdır' }
            ],
            answer: 0
          },
          {
            q: { en: 'What is the correct order of working, according to promise 7?', tr: 'Söz 7\'ye göre doğru çalışma sırası nedir?' },
            options: [
              { en: 'Write my own draft first, then receive assistance with AI', tr: 'Önce kendi taslağımı yazmak, sonra yapay zekâdan yardım almak' },
              { en: 'Let AI write the draft, then edit it', tr: 'Taslağı YZ\'ye yazdırmak, sonra düzenlemek' },
              { en: 'Ask AI for the full text, then translate it', tr: 'YZ\'den tam metni isteyip sonra çevirmek' },
              { en: 'Copy a classmate\'s draft first', tr: 'Önce bir sınıf arkadaşının taslağını kopyalamak' }
            ],
            answer: 0
          },
          {
            q: { en: 'What should you do with AI suggestions, according to promise 8?', tr: 'Söz 8\'e göre YZ önerileriyle ne yapmalısınız?' },
            options: [
              { en: 'Think critically about them and decide what to keep', tr: 'Eleştirel olarak değerlendirip neyin kalacağına kendim karar vermek' },
              { en: 'Accept all of them without reading', tr: 'Okumadan hepsini kabul etmek' },
              { en: 'Reject all of them automatically', tr: 'Hepsini otomatik olarak reddetmek' },
              { en: 'Forward them to the teacher', tr: 'Öğretmene iletmek' }
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
            q: { en: 'Can AI write your whole essay?', tr: 'YZ tüm makalenizi yazabilir mi?' },
            options: [
              { en: 'No. It results in a grade of 0 and a warning', tr: 'Hayır. 0 not ve uyarı ile sonuçlanır' },
              { en: 'Yes, if it is short', tr: 'Evet, kısaysa' },
              { en: 'Yes, at the weekend', tr: 'Evet, hafta sonları' },
              { en: 'Yes, if you edit one sentence', tr: 'Evet, bir cümleyi düzenlerseniz' }
            ],
            answer: 0
          },
          {
            q: { en: 'Can you use AI during a test?', tr: 'Sınav sırasında YZ kullanabilir misiniz?' },
            options: [
              { en: 'No. Tests must show your own ability', tr: 'Hayır. Sınavlar kendi yeteneğinizi göstermelidir' },
              { en: 'Yes, for difficult questions only', tr: 'Evet, sadece zor sorularda' },
              { en: 'Yes, with an AI Use Note', tr: 'Evet, YZ Kullanım Notu ile' },
              { en: 'Yes, in the last ten minutes', tr: 'Evet, son on dakikada' }
            ],
            answer: 0
          },
          {
            q: { en: 'What happens if you forget to declare your AI use?', tr: 'YZ kullanımınızı bildirmeyi unutursanız ne olur?' },
            options: [
              { en: 'The work is not graded until it is declared', tr: 'Bildirilene kadar çalışma notlandırılmaz' },
              { en: 'Nothing happens', tr: 'Hiçbir şey olmaz' },
              { en: 'You automatically pass', tr: 'Otomatik olarak geçersiniz' },
              { en: 'You get a higher grade', tr: 'Daha yüksek not alırsınız' }
            ],
            answer: 0
          },
          {
            q: { en: 'AI gives you an offensive or inappropriate answer. What should you do?', tr: 'YZ size uygunsuz veya saldırgan bir cevap verdi. Ne yapmalısınız?' },
            options: [
              { en: 'Do not use it and inform your instructor immediately', tr: 'Kullanmayın ve hemen öğretim görevlisine bildirin' },
              { en: 'Use it anyway if it is helpful', tr: 'Faydalıysa yine de kullanın' },
              { en: 'Share it with your classmates', tr: 'Sınıf arkadaşlarınızla paylaşın' },
              { en: 'Argue with the AI', tr: 'YZ ile tartışın' }
            ],
            answer: 0
          },
          {
            q: { en: 'In group work, how is each member\'s contribution marked in the shared AI Use Note?', tr: 'Grup çalışmasında her üyenin katkısı ortak YZ Kullanım Notu\'nda nasıl belirtilir?' },
            options: [
              { en: 'With their initials', tr: 'Baş harfleriyle' },
              { en: 'With photographs', tr: 'Fotoğraflarla' },
              { en: 'It is not marked at all', tr: 'Hiç belirtilmez' },
              { en: 'Only the leader is named', tr: 'Sadece lider belirtilir' }
            ],
            answer: 0
          },
          {
            q: { en: 'A group member cannot explain the AI-generated content in the work. What may happen?', tr: 'Bir grup üyesi çalışmadaki YZ üretimi içeriği açıklayamıyor. Ne olabilir?' },
            options: [
              { en: 'The grade may be adjusted', tr: 'Not değiştirilebilir' },
              { en: 'Nothing can happen', tr: 'Hiçbir şey olmaz' },
              { en: 'The group gets a bonus', tr: 'Grup bonus alır' },
              { en: 'Only the teacher is responsible', tr: 'Sadece öğretmen sorumludur' }
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
            q: { en: 'What happens after a FIRST violation of the AI rules?', tr: 'YZ kurallarının İLK ihlalinden sonra ne olur?' },
            options: [
              { en: 'The work is returned for revision or integrity review', tr: 'Çalışma revizyon veya dürüstlük incelemesi için iade edilir' },
              { en: 'Immediate course failure', tr: 'Anında ders başarısızlığı' },
              { en: 'Nothing at all', tr: 'Hiçbir şey olmaz' },
              { en: 'A fine must be paid', tr: 'Para cezası ödenir' }
            ],
            answer: 0
          },
          {
            q: { en: 'What is the consequence of a SECOND violation?', tr: 'İKİNCİ ihlalin sonucu nedir?' },
            options: [
              { en: 'Grade 0 and a written warning', tr: '0 not ve yazılı uyarı' },
              { en: 'Only a friendly reminder', tr: 'Sadece dostça bir hatırlatma' },
              { en: 'Extra homework', tr: 'Ekstra ödev' },
              { en: 'A two-day suspension', tr: 'İki gün uzaklaştırma' }
            ],
            answer: 0
          },
          {
            q: { en: 'Repeated use of AI in tests can lead to...', tr: 'Sınavlarda tekrarlanan YZ kullanımı şuna yol açabilir...' },
            options: [
              { en: 'an integrity review, probation, or course failure', tr: 'dürüstlük incelemesi, uyarı veya ders başarısızlığı' },
              { en: 'a better seat in class', tr: 'sınıfta daha iyi bir yer' },
              { en: 'a make-up exam', tr: 'telafi sınavı' },
              { en: 'no consequence after the first warning', tr: 'ilk uyarıdan sonra hiçbir yaptırım' }
            ],
            answer: 0
          },
          {
            q: { en: 'Where are serious or repeated cases of misuse referred?', tr: 'Ciddi veya tekrarlanan ihlaller nereye sevk edilir?' },
            options: [
              { en: 'The University Academic Integrity and Discipline Board', tr: 'Üniversite Akademik Dürüstlük ve Disiplin Kurulu\'na' },
              { en: 'The student council', tr: 'Öğrenci konseyine' },
              { en: 'The cafeteria committee', tr: 'Yemekhane komisyonuna' },
              { en: 'No one; they are ignored', tr: 'Hiçbir yere; görmezden gelinir' }
            ],
            answer: 0
          },
          {
            q: { en: 'Under which policy is AI misuse handled?', tr: 'YZ\'nin yanlış kullanımı hangi politika kapsamında değerlendirilir?' },
            options: [
              { en: 'The Academic Integrity Policy', tr: 'Akademik Dürüstlük Politikası' },
              { en: 'The library policy', tr: 'Kütüphane politikası' },
              { en: 'The attendance policy', tr: 'Devam politikası' },
              { en: 'The dress code', tr: 'Kıyafet yönetmeliği' }
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
          q: { en: 'What is the purpose of AI use in the English Preparatory Program?', tr: 'İngilizce Hazırlık Programında YZ kullanımının amacı nedir?' },
          options: [
            { en: 'To support learning while upholding academic integrity, not to replace individual effort', tr: 'Akademik dürüstlüğü koruyarak öğrenmeyi desteklemek; bireysel çabanın yerine geçmek değil' },
            { en: 'To write assignments faster', tr: 'Ödevleri daha hızlı yazmak' },
            { en: 'To replace teachers', tr: 'Öğretmenlerin yerini almak' },
            { en: 'To shorten lessons', tr: 'Dersleri kısaltmak' }
          ],
          answer: 0
        },
        {
          q: { en: 'Who carries the final responsibility for all submitted work?', tr: 'Teslim edilen tüm çalışmaların nihai sorumluluğu kime aittir?' },
          options: [
            { en: 'The student', tr: 'Öğrenciye' },
            { en: 'The AI tool', tr: 'YZ aracına' },
            { en: 'The instructor', tr: 'Öğretim görevlisine' },
            { en: 'The university board', tr: 'Üniversite kuruluna' }
          ],
          answer: 0
        },
        {
          q: { en: 'Which of these is NOT an allowed use of AI?', tr: 'Aşağıdakilerden hangisi YZ\'nin izin verilen bir kullanımı DEĞİLDİR?' },
          options: [
            { en: 'Having AI write the final text you submit for grading', tr: 'Notlandırılacak nihai metni YZ\'ye yazdırmak' },
            { en: 'Generating ideas', tr: 'Fikir üretmek' },
            { en: 'Practising language skills', tr: 'Dil becerilerini geliştirmek' },
            { en: 'Receiving grammar explanations', tr: 'Dilbilgisi açıklamaları almak' }
          ],
          answer: 0
        },
        {
          q: { en: 'What must an AI Use Note include?', tr: 'Bir YZ Kullanım Notu neyi içermelidir?' },
          options: [
            { en: 'The original prompts used with the AI', tr: 'YZ ile kullanılan orijinal istemleri' },
            { en: 'Your exam timetable', tr: 'Sınav programınızı' },
            { en: 'Your student card number only', tr: 'Sadece öğrenci kart numaranızı' },
            { en: 'The names of your classmates', tr: 'Sınıf arkadaşlarınızın isimlerini' }
          ],
          answer: 0
        },
        {
          q: { en: 'AI gave you more than two consecutive sentences that you used. The work is now considered...', tr: 'YZ\'nin verdiği art arda ikiden fazla cümleyi kullandınız. Çalışma artık şöyle sayılır...' },
          options: [
            { en: 'AI-written, and this must be declared in the AI Use Note', tr: 'YZ ile yazılmış; bu durum YZ Kullanım Notu\'nda belirtilmelidir' },
            { en: 'Completely your own work', tr: 'Tamamen sizin çalışmanız' },
            { en: 'Group work', tr: 'Grup çalışması' },
            { en: 'Ungradeable forever', tr: 'Sonsuza dek notlandırılamaz' }
          ],
          answer: 0
        },
        {
          q: { en: 'According to your promises, what comes FIRST?', tr: 'Sözlerinize göre ÖNCE ne gelir?' },
          options: [
            { en: 'Writing my own draft; AI assistance comes afterwards', tr: 'Kendi taslağımı yazmak; YZ yardımı sonra gelir' },
            { en: 'Asking AI for a full draft', tr: 'YZ\'den tam taslak istemek' },
            { en: 'Copying the textbook', tr: 'Ders kitabını kopyalamak' },
            { en: 'Writing the AI Use Note', tr: 'YZ Kullanım Notu\'nu yazmak' }
          ],
          answer: 0
        },
        {
          q: { en: 'Claiming AI\'s work as your own is...', tr: 'YZ\'nin çalışmasını kendinize mal etmek...' },
          options: [
            { en: 'plagiarism', tr: 'intihaldir' },
            { en: 'efficiency', tr: 'verimliliktir' },
            { en: 'allowed once per term', tr: 'dönemde bir kez serbesttir' },
            { en: 'only a problem in exams', tr: 'sadece sınavlarda sorundur' }
          ],
          answer: 0
        },
        {
          q: { en: 'Using AI in a test results in...', tr: 'Sınavda YZ kullanmak şununla sonuçlanır...' },
          options: [
            { en: 'grade 0 and a formal warning', tr: '0 not ve resmi uyarı' },
            { en: 'a retake next week', tr: 'gelecek hafta telafi' },
            { en: 'half marks', tr: 'yarım puan' },
            { en: 'no consequence', tr: 'hiçbir yaptırım yok' }
          ],
          answer: 0
        },
        {
          q: { en: 'In group work with AI, every member must write a short...', tr: 'YZ ile grup çalışmasında her üye kısa bir ... yazmalıdır.' },
          options: [
            { en: '"learning line" describing their use of AI', tr: 'YZ kullanımını açıklayan "öğrenme satırı"' },
            { en: 'poem about teamwork', tr: 'takım çalışması hakkında şiir' },
            { en: 'apology letter', tr: 'özür mektubu' },
            { en: 'list of excuses', tr: 'bahane listesi' }
          ],
          answer: 0
        },
        {
          q: { en: 'Serious or repeated misuse of AI is referred to...', tr: 'Ciddi veya tekrarlanan YZ ihlalleri nereye sevk edilir?' },
          options: [
            { en: 'the University Academic Integrity and Discipline Board', tr: 'Üniversite Akademik Dürüstlük ve Disiplin Kurulu\'na' },
            { en: 'the sports committee', tr: 'spor komitesine' },
            { en: 'the canteen staff', tr: 'kantin personeline' },
            { en: 'other students', tr: 'diğer öğrencilere' }
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
      signName: 'Alireza Shahin KABIRIASLIFAR',
      signTitle: { en: 'AI Course Advisor', tr: 'YZ Kursu Danışmanı' }
    }
  };
})();
