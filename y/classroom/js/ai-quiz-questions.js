/* ============================================================
   AI QUIZ - the question bank for the classroom AI game
   ------------------------------------------------------------
   THIS IS THE FILE TO EDIT WHEN THE QUESTIONS CHANGE.
   Nothing else needs touching: the game reads whatever is here.

   The questions were taken from the AI Use Guidelines mini course
   (student/js/policy-course-content.js), so a student who has done
   the course meets the same material here. They are kept as a
   SEPARATE copy on purpose: the course is assessed and must not
   change because somebody wanted a livelier game question.

   HOW TO CHANGE A QUESTION
     Edit its text in place. Keep both languages.

   HOW TO REMOVE ONE FROM THE GAME
     Set  active: false
     Do not delete it, so the id is never reused for a different
     question.

   HOW TO ADD ONE
     Copy any block below. Give it an id that is not already used.
     `answer` is the INDEX of the correct option, counting from 0,
     so 0 is the first option and 3 is the fourth.

   HOW MANY ARE ASKED
     CONFIG.questionCount. There are more questions here than a
     game uses, so the set is not identical every time.

   EVERY QUESTION CARRIES ITS MODULE, so the game can show which
   part of the course it came from, and so a module can be dropped
   from a game without hunting through the list.
   ============================================================ */
(function () {
  'use strict';

  window.AI_QUIZ = {
    id: 'ai-guidelines-quiz-v1',
    title: { en: 'AI Quiz', tr: 'YZ Testi' },
    source: { en: 'AI Use Guidelines', tr: 'Yapay Zekâ Kullanım Kuralları' },

    CONFIG: {
      // How many questions one game asks.
      questionCount: 20,
      // Seconds a question stays open before the teacher can close it.
      // The teacher can always close early.
      secondsPerQuestion: 30,
      // Points for a correct answer, plus a speed bonus that decays to 0
      // across the question's time.
      pointsCorrect: 100,
      pointsSpeedBonus: 50
    },

    // Titles shown with a question, keyed by the module it came from. Both
    // languages, word for word the course's own titles
    // (student/js/policy-course-content.js), so the game and the course match.
    modules: {
    m1: { en: "Module 1 · Purpose and Rules of AI Use",  tr: "Modül 1 · YZ Kullanımının Amacı ve Kuralları" },
    m2: { en: "Module 2 · Your 8 AI Promises",           tr: "Modül 2 · 8 YZ Sözünüz" },
    m3: { en: "Module 3 · Quick Answers and Group Work", tr: "Modül 3 · Hızlı Cevaplar ve Grup Çalışması" },
    m4: { en: "Module 4 · Consequences for Misuse",      tr: "Modül 4 · Yanlış Kullanımın Sonuçları" }
    },

    questions: [
    {
      id: "m1-q01",
      module: "m1",
      active: true,
      q: { en: "Which language should you normally use with AI tools?",
           tr: "YZ araçlarıyla normalde hangi dili kullanmalısınız?" },
      options: [
        { en: "English, with Turkish only for technical or cultural clarification",
          tr: "İngilizce; Türkçe yalnızca teknik veya kültürel açıklama için" },
        { en: "Turkish for every interaction, and English only inside direct quotations",
          tr: "Her etkileşimde Türkçe, İngilizce yalnızca doğrudan alıntıların içinde" },
        { en: "English for prompts, Turkish for the answers",
          tr: "İstemler için İngilizce, yanıtlar için Türkçe" },
        { en: "Whichever language is fastest to type",
          tr: "Yazması en hızlı olan dil hangisiyse" }
      ],
      answer: 0
    },
    {
      id: "m1-q02",
      module: "m1",
      active: true,
      q: { en: "Which of these is an allowed use of AI in coursework?",
           tr: "Aşağıdakilerden hangisi ders çalışmasında YZ'nin izin verilen kullanımıdır?" },
      options: [
        { en: "Brainstorming ideas and examples",
          tr: "Fikir ve örnek beyin fırtınası yapmak" },
        { en: "Producing the final text you submit",
          tr: "Teslim ettiğiniz nihai metni üretmek" },
        { en: "Answering questions during a test",
          tr: "Sınav sırasında soruları yanıtlamak" },
        { en: "Replacing your own draft entirely",
          tr: "Kendi taslağınızın tamamen yerine geçmek" }
      ],
      answer: 0
    },
    {
      id: "m1-q03",
      module: "m1",
      active: true,
      q: { en: "What must an AI Use Note include?",
           tr: "Bir YZ Kullanım Notu neyi içermelidir?" },
      options: [
        { en: "The original prompts you used",
          tr: "Kullandığınız orijinal istemleri" },
        { en: "A word count of the AI text",
          tr: "YZ metninin kelime sayısını" },
        { en: "The name of the AI tool only",
          tr: "Yalnızca YZ aracının adını" },
        { en: "Your estimated final grade",
          tr: "Tahmini final notunuzu" }
      ],
      answer: 0
    },
    {
      id: "m1-q04",
      module: "m1",
      active: true,
      q: { en: "When is work counted as \"AI-written\"?",
           tr: "Bir çalışma ne zaman \"YZ ile yazılmış\" sayılır?" },
      options: [
        { en: "When AI gives more than two consecutive sentences or the task outline",
          tr: "YZ art arda ikiden fazla cümle veya görev taslağı verdiğinde" },
        { en: "When AI corrects one spelling mistake or rewrites a sentence for clarity",
          tr: "YZ bir yazım hatasını düzelttiğinde veya bir cümleyi netlik için yeniden yazdığında" },
        { en: "When AI suggests one synonym for a word",
          tr: "YZ bir kelime için tek bir eşanlamlı önerdiğinde" },
        { en: "When AI explains a grammar rule to you",
          tr: "YZ size bir dilbilgisi kuralını açıkladığında" }
      ],
      answer: 0
    },
    {
      id: "m1-q05",
      module: "m1",
      active: true,
      q: { en: "You edited a sentence that AI wrote. What is the rule?",
           tr: "YZ'nin yazdığı bir cümleyi düzenlediniz. Kural nedir?" },
      options: [
        { en: "It still counts as AI-assisted and must be declared",
          tr: "Yine de YZ destekli sayılır ve belirtilmelidir" },
        { en: "It becomes completely your own work and needs no AI note",
          tr: "Tamamen sizin çalışmanız olur ve YZ notuna gerek kalmaz" },
        { en: "Only the unedited parts must be declared",
          tr: "Sadece düzenlenmemiş kısımlar belirtilmelidir" },
        { en: "It no longer belongs in the AI Use Note",
          tr: "Artık YZ Kullanım Notu'na ait değildir" }
      ],
      answer: 0
    },
    {
      id: "m1-q06",
      module: "m1",
      active: true,
      q: { en: "You deleted the prompts you used with AI. You should...",
           tr: "YZ ile kullandığınız istemleri sildiniz. Şunu yapmalısınız..." },
      options: [
        { en: "re-create them and label them \"re-created\"",
          tr: "yeniden oluşturup \"yeniden oluşturuldu\" olarak işaretlemek" },
        { en: "leave that part of the note blank",
          tr: "notun o kısmını boş bırakmak" },
        { en: "submit the work without the note",
          tr: "çalışmayı notsuz teslim etmek" },
        { en: "copy a classmate's prompts and submit them as your own",
          tr: "bir arkadaşın istemlerini kopyalayıp kendinizinmiş gibi sunmak" }
      ],
      answer: 0
    },
    {
      id: "m2-q07",
      module: "m2",
      active: true,
      q: { en: "How much of your work may AI create?",
           tr: "Çalışmanızın ne kadarını YZ üretebilir?" },
      options: [
        { en: "Not most of it; the work stays mine",
          tr: "Çoğunu değil; çalışma benim kalır" },
        { en: "Most of it, if I edit afterwards",
          tr: "Çoğunu, sonradan düzenlersem" },
        { en: "The parts I find too difficult",
          tr: "Zor bulduğum kısımları" },
        { en: "My whole first draft",
          tr: "Tüm ilk taslağımı" }
      ],
      answer: 0
    },
    {
      id: "m2-q08",
      module: "m2",
      active: true,
      q: { en: "Whose voice and style should your submitted work keep?",
           tr: "Teslim ettiğiniz çalışma kimin sesini ve tarzını korumalıdır?" },
      options: [
        { en: "My own voice and style",
          tr: "Kendi sesimi ve tarzımı" },
        { en: "The AI's polished style",
          tr: "YZ'nin parlak tarzını" },
        { en: "A model essay's style",
          tr: "Örnek bir makalenin tarzını" },
        { en: "My teacher's writing style",
          tr: "Öğretmenimin yazım tarzını" }
      ],
      answer: 0
    },
    {
      id: "m2-q09",
      module: "m2",
      active: true,
      q: { en: "Claiming AI's work as your own is...",
           tr: "YZ'nin çalışmasını kendinize mal etmek..." },
      options: [
        { en: "plagiarism",
          tr: "intihaldir" },
        { en: "acceptable time-saving",
          tr: "kabul edilebilir bir zaman tasarrufudur" },
        { en: "allowed with a note",
          tr: "bir notla serbesttir" },
        { en: "fine for drafts only",
          tr: "sadece taslaklar için uygundur" }
      ],
      answer: 0
    },
    {
      id: "m2-q10",
      module: "m2",
      active: true,
      q: { en: "In what order should you work (promise 7)?",
           tr: "Hangi sırayla çalışmalısınız (Söz 7)?" },
      options: [
        { en: "My own draft first, AI help afterwards",
          tr: "Önce kendi taslağım, sonra YZ yardımı" },
        { en: "AI draft first, then I edit it",
          tr: "Önce YZ taslağı, sonra ben düzenlerim" },
        { en: "AI and I take turns writing alternate paragraphs",
          tr: "YZ ve ben sırayla, dönüşümlü olarak paragraf yazarız" },
        { en: "AI outlines, then I fill it in",
          tr: "YZ taslak çıkarır, sonra ben doldururum" }
      ],
      answer: 0
    },
    {
      id: "m2-q11",
      module: "m2",
      active: true,
      q: { en: "What should you do with AI's suggestions (promise 8)?",
           tr: "YZ'nin önerileriyle ne yapmalısınız (Söz 8)?" },
      options: [
        { en: "Judge each one and decide what to keep",
          tr: "Her birini değerlendirip neyin kalacağına karar vermek" },
        { en: "Accept every suggestion as correct",
          tr: "Her öneriyi doğru kabul etmek" },
        { en: "Reject every suggestion on principle",
          tr: "İlke olarak her öneriyi reddetmek" },
        { en: "Pass the suggestions to the teacher",
          tr: "Önerileri öğretmene iletmek" }
      ],
      answer: 0
    },
    {
      id: "m3-q12",
      module: "m3",
      active: true,
      q: { en: "Can AI write your whole essay for grading?",
           tr: "YZ, notlandırılmak üzere tüm makalenizi yazabilir mi?" },
      options: [
        { en: "No; it scores 0 and brings a warning",
          tr: "Hayır; 0 alır ve uyarı getirir" },
        { en: "Yes, if you shorten it afterwards",
          tr: "Evet, sonradan kısaltırsanız" },
        { en: "Yes, for low-weighted tasks",
          tr: "Evet, düşük ağırlıklı görevlerde" },
        { en: "Yes, if you name the AI tool",
          tr: "Evet, YZ aracını belirtirseniz" }
      ],
      answer: 0
    },
    {
      id: "m3-q13",
      module: "m3",
      active: true,
      q: { en: "Can you use AI during a test?",
           tr: "Sınav sırasında YZ kullanabilir misiniz?" },
      options: [
        { en: "No; tests must show your own ability",
          tr: "Hayır; sınavlar kendi yeteneğinizi göstermelidir" },
        { en: "Yes, but only for the hardest questions on the test",
          tr: "Evet, ancak yalnızca testteki en zor sorularda" },
        { en: "Yes, if you add an AI Use Note",
          tr: "Evet, bir YZ Kullanım Notu eklerseniz" },
        { en: "Yes, for spelling checks only",
          tr: "Evet, sadece yazım denetiminde" }
      ],
      answer: 0
    },
    {
      id: "m3-q14",
      module: "m3",
      active: true,
      q: { en: "You forgot to declare your AI use. What happens?",
           tr: "YZ kullanımını bildirmeyi unuttunuz. Ne olur?" },
      options: [
        { en: "It is not graded until you declare it",
          tr: "Siz bildirene kadar notlandırılmaz" },
        { en: "The grade simply drops by ten percent automatically",
          tr: "Not otomatik olarak yüzde on oranında düşer" },
        { en: "Nothing about the grade changes",
          tr: "Notla ilgili hiçbir şey değişmez" },
        { en: "The deadline is extended for you",
          tr: "Teslim tarihi sizin için uzatılır" }
      ],
      answer: 0
    },
    {
      id: "m3-q15",
      module: "m3",
      active: true,
      q: { en: "AI gives an offensive or inappropriate answer. You should...",
           tr: "YZ uygunsuz veya saldırgan bir yanıt verdi. Şunu yapmalısınız..." },
      options: [
        { en: "not use it and tell your instructor",
          tr: "kullanmamak ve öğretim görevlinize söylemek" },
        { en: "use it but soften the wording",
          tr: "kullanmak ama ifadeyi yumuşatmak" },
        { en: "report it to the AI company",
          tr: "YZ şirketine bildirmek" },
        { en: "share it so others can avoid it",
          tr: "başkaları kaçınsın diye paylaşmak" }
      ],
      answer: 0
    },
    {
      id: "m3-q16",
      module: "m3",
      active: true,
      q: { en: "In group work, how is each member's contribution marked?",
           tr: "Grup çalışmasında her üyenin katkısı nasıl belirtilir?" },
      options: [
        { en: "With each member's initials",
          tr: "Her üyenin baş harfleriyle" },
        { en: "With one signature for the group",
          tr: "Grup için tek bir imzayla" },
        { en: "By word count per member",
          tr: "Üye başına kelime sayısıyla" },
        { en: "The leader alone signs it",
          tr: "Yalnızca lider imzalar" }
      ],
      answer: 0
    },
    {
      id: "m3-q17",
      module: "m3",
      active: true,
      q: { en: "A member cannot explain the AI content in the work. What may happen?",
           tr: "Bir üye çalışmadaki YZ içeriğini açıklayamıyor. Ne olabilir?" },
      options: [
        { en: "The grade may be adjusted",
          tr: "Not değiştirilebilir" },
        { en: "The whole group fails automatically",
          tr: "Tüm grup otomatik olarak kalır" },
        { en: "Nothing changes about the grade",
          tr: "Notla ilgili hiçbir şey değişmez" },
        { en: "Only that member is praised",
          tr: "Sadece o üye övülür" }
      ],
      answer: 0
    },
    {
      id: "m4-q18",
      module: "m4",
      active: true,
      q: { en: "What is the outcome of a first violation?",
           tr: "İlk ihlalin sonucu nedir?" },
      options: [
        { en: "The work is returned for revision or review",
          tr: "Çalışma revizyon veya inceleme için iade edilir" },
        { en: "The student immediately fails the entire course",
          tr: "Öğrenci anında tüm dersten kalmış sayılır" },
        { en: "A fine is added to tuition",
          tr: "Öğrenim ücretine ceza eklenir" },
        { en: "The account is suspended for a week",
          tr: "Hesap bir hafta askıya alınır" }
      ],
      answer: 0
    },
    {
      id: "m4-q19",
      module: "m4",
      active: true,
      q: { en: "What is the consequence of a second violation?",
           tr: "İkinci ihlalin sonucu nedir?" },
      options: [
        { en: "Grade 0 and a written warning",
          tr: "0 not ve yazılı uyarı" },
        { en: "A verbal reminder from the teacher",
          tr: "Öğretmenden sözlü bir hatırlatma" },
        { en: "Extra practice tasks to complete",
          tr: "Tamamlanacak ek pratik görevleri" },
        { en: "A one-week class suspension",
          tr: "Bir haftalık sınıf uzaklaştırması" }
      ],
      answer: 0
    },
    {
      id: "m4-q20",
      module: "m4",
      active: true,
      q: { en: "Repeated use of AI in tests can lead to...",
           tr: "Sınavlarda tekrarlanan YZ kullanımı şuna yol açabilir..." },
      options: [
        { en: "an integrity review, probation, or course failure",
          tr: "dürüstlük incelemesi, şartlı durum veya ders başarısızlığı" },
        { en: "a simple make-up test scheduled the following week",
          tr: "ertesi hafta için planlanan basit bir telafi sınavı" },
        { en: "losing ten percent of the grade",
          tr: "notun yüzde onunu kaybetme" },
        { en: "no action after the first warning",
          tr: "ilk uyarıdan sonra işlem yapılmaması" }
      ],
      answer: 0
    },
    {
      id: "m4-q21",
      module: "m4",
      active: true,
      q: { en: "Serious or repeated misuse is referred to...",
           tr: "Ciddi veya tekrarlanan ihlal şuraya sevk edilir..." },
      options: [
        { en: "the Academic Integrity and Discipline Board",
          tr: "Akademik Dürüstlük ve Disiplin Kurulu'na" },
        { en: "the elected student representative council only",
          tr: "yalnızca seçilmiş öğrenci temsilcileri konseyine" },
        { en: "the teacher's department head only",
          tr: "yalnızca öğretmenin bölüm başkanına" },
        { en: "the program's social committee",
          tr: "programın sosyal komitesine" }
      ],
      answer: 0
    },
    {
      id: "m4-q22",
      module: "m4",
      active: true,
      q: { en: "Which policy governs AI misuse?",
           tr: "YZ'nin yanlış kullanımını hangi politika yönetir?" },
      options: [
        { en: "The Academic Integrity Policy",
          tr: "Akademik Dürüstlük Politikası" },
        { en: "The student attendance policy",
          tr: "Öğrenci devam politikası" },
        { en: "The library lending policy",
          tr: "Kütüphane ödünç verme politikası" },
        { en: "The campus conduct timetable",
          tr: "Kampüs davranış çizelgesi" }
      ],
      answer: 0
    }
    ]
  };

  // Convenience for the game: only the questions currently in play.
  window.AI_QUIZ.activeQuestions = function () {
    return window.AI_QUIZ.questions.filter(function (x) { return x.active !== false; });
  };
})();
