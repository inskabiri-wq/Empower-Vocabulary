/**
 * Lingualab - Listening Exam Module
 * Audio player + exam questions + karaoke transcript + tracking
 */

// ─── Transcript Data (timestamped segments) ──────────────────────────────────
// Anchors provided by the teacher:
//   Intro is separate (plays near the start, then a pause to read Section 1)
//   Section 1 ("I'm joined today…") starts at 1:23  (83 s)  → +73 from 10-baseline
//   Section 2 starts at 8:34                        (514 s) → +54 from 460-baseline
//   Section 3 starts at 15:07                       (907 s) → +7  from 900-baseline
// Timings re-aligned 2026-04-21 from Whisper SRT via tools/align-from-srt.js.
// All 33 segments aligned with ≥0.96 confidence. Sections 2 and 3 had large
// drift in the original teacher-supplied times (up to −131s on target 22 and
// −125s on target 32); those are now corrected to real audio positions.
const EXAM_TRANSCRIPT = [
  { start:    0.3, end:   15.6, text: "You have one minute to read the questions before each section. You will hear the recordings after the beep. Each recording will play twice.", section: 'intro' },
  { start:   78.8, end:   97.3, text: "I'm joined today by Matthew Piscatelli, who has worked as an archaeologist, a university professor, and an explorer for the National Geographic Society. Welcome, Matthew, and thank you for being here.", section: 1 },
  { start:   97.7, end:  102.8, text: "Now, my first question for you is this. Why should people care about archaeology?", section: 1 },
  { start:  103.2, end:  106.3, text: "Why should we care about some stones and bones?", section: 1 },
  { start:  106.7, end:  116.4, text: "I think it's important to study objects from the past, from ancient civilizations because of the old cliché that we learn about the future by studying the past. The past is who we are.", section: 1 },
  { start:  116.6, end:  129.8, text: "We learn more about where we come from, and it helps us learn more about our identity today. We need to study those ancient civilizations so we can help prepare for the future. And archaeology is also important because it inspires curiosity.", section: 1 },
  { start:  130.1, end:  140.9, text: "People feel a connection to the past when I say, you know, you're walking in the footsteps of ancient people, or this is what it was like to live 5000 years ago. I think there's something very interesting about that.", section: 1 },
  { start:  141.2, end:  158.1, text: "So it's important that we as archaeologists not simply do our excavations, write a report and then file that away where nobody will read about it. We need to communicate what we do and the importance of what we do. We need to ask ourselves, why does what you propose to do really matter? Who's going to care?", section: 1 },
  { start:  167.2, end:  182.8, text: "Now, I think it's fair to say that when most people think about archaeology, they think about uncovering objects from cultures like ancient Greece, Rome, and Egypt. Why do you think that is? What is it about societies like these that inspires us so much?", section: 1 },
  { start:  183.1, end:  201.8, text: "So there are a lot of famous sites in the world, like Stonehenge and the Pyramids of Giza that people are always excited to learn about. And there's something charismatic about them. They have been around for thousands of years.", section: 1 },
  { start:  202.5, end:  218.8, text: "People have constantly been interested in these sites. And I think it's from the charisma, the wonder, the awe of these sites. It's something about archaeology that makes us wonder, what was it like to live in the past? What was it like to build the pyramids or to build Stonehenge?", section: 1 },
  { start:  223.2, end:  239.9, text: "Are there any archaeological sites or ancient cultures you think people should know more about? When we look at all of the work that our National Geographic explorers are doing all over the world, we come to realize that the world is a very ancient place and there are a lot of civilizations out there to be discovered.", section: 1 },
  { start:  240.1, end:  255.8, text: "Now in some of those places, like in Egypt, there's a long history of study. Some other places are more like the Wild West, and that we don't know as much. For example, in Peru, we know Machu Picchu. We know some sites along the North Coast of Peru which are very famous.", section: 1 },
  { start:  513.2, end:  523.8, text: "Hi, Serena. How's it going? Oh, hi, Liam. Everything's fine with me. What's new with you? Not much. Well, actually, I'm trying to decide where to go to college.", section: 2 },
  { start:  524.1, end:  537.8, text: "Which colleges are top on your list? Just three right now. New York University, the University of Southern Maine, and Mount Royal University. What was the last one? Mount Royal? Where is it?", section: 2 },
  { start:  538.2, end:  552.8, text: "It's in Calgary in Canada. Huh. Don't be offended, but that seems like a pretty random selection of schools. I mean, I can understand NYU, I'd love to go to college in New York, but why Maine or Calgary?", section: 2 },
  { start:  553.1, end:  562.8, text: "Because I'd like to get a degree in ecotourism and there aren't that many colleges that offer it. Ecotourism. You're going to have to tell me what that is.", section: 2 },
  { start:  563.2, end:  576.8, text: "My parents said the same thing. Basically, ecotourism tries to make sure travelers have a great experience, but in a way that can preserve nature and benefit local people. It's about finding a balance between tourism and the environment.", section: 2 },
  { start:  577.2, end:  591.8, text: "So it's like tourists get to visit natural areas without having a negative impact on them. That's pretty cool. I know, right? I've always loved traveling, so getting a job related to travel is kind of a dream of mine.", section: 2 },
  { start:  592.2, end:  608.4, text: "And I've heard that ecotourism is a real growth area in the tourism industry right now, so I'm hoping it'll be easy to find a job after I graduate. And there are so many news stories these days about how humans have damaged the environment, so it seems like the right thing is to try and protect it.", section: 2 },
  { start:  609.6, end:  630.8, text: "But isn't air travel bad? Traveling by airplane is one of the worst things you can do for the environment. You're absolutely right, Serena. So the idea behind ecotourism is to find a compromise. If people are going to travel somewhere, ecotourism says let's make sure they travel in a way that causes as little damage as possible.", section: 2 },
  { start:  631.2, end:  642.8, text: "Let's make sure they act in a responsible way when they arrive. Let's make sure they know the harm that humans can do to the landscape. That sounds good in theory, but how does it work in practice?", section: 2 },
  { start:  643.2, end:  664.8, text: "Well, I was reading about ecotourism in Madagascar. Apparently there's a National Park there called Tsingy de Bemaraha or something. It's this amazing landscape, like a forest of sharp rocks. A great tourist destination, but it's hard for tourists to get there and they're likely to damage the landscape. It's a pretty fragile place apparently.", section: 2 },
  { start:  907.4, end:  926.0, text: "We could ask ourselves, does it matter? Does it matter that young people are playing fewer sports or being less active? Most of us would probably answer yes it does. Our intuition tells us that it is good for our long term health and happiness.", section: 3 },
  { start:  926.4, end:  944.9, text: "But there is also research showing that graduates who participate in college sports go on to earn 20% more in their future careers than other non-sporting students. Why is this? Well, here are 5 good reasons.", section: 3 },
  { start:  945.5, end:  968.9, text: "Reason number one is teamwork. It's important for any team to know how to work together, and by playing sports, you're developing the skill of working with others towards achieving a goal. You are also learning that everyone brings different talents and by working together you can overcome obstacles.", section: 3 },
  { start:  969.7, end:  992.0, text: "Reason number two: Leadership. When people play sports, especially team sports, captains and leaders tend to emerge from a group of people. These are the people who make the tough decisions and inspire others, especially when you are losing. They are also the leaders of the future.", section: 3 },
  { start:  992.4, end: 1017.9, text: "Managing time is another skill that you develop through doing sports. In college, your first priority might be attending classes and studying. But if you're on a sports team, you also have to go to regular practice sessions. Balancing all these demands along with the need for socializing with friends means that you are learning time management.", section: 3 },
  { start: 1018.5, end: 1038.0, text: "That's the third reason participating in sports can help your future career. Along with time management and preparation for a sporting competition comes pressure. Playing a sport forces you to deal with pressure and develop strategies to cope with difficult situations.", section: 3 },
  { start: 1038.4, end: 1049.0, text: "Although not every career is stressful or high pressure, everyone will experience anxiety at some point and will need to learn to stay calm.", section: 3 },
  { start: 1049.4, end: 1076.0, text: "Reason number five for being involved in a Sports Club or team isn't directly related to physical exercise either. Clubs and teams need people to coordinate them. They need people to raise money, buy new equipment and make sure the club has new members. Students who take on these tasks are learning organization skills, which are essential for future managers.", section: 3 },
  { start: 1076.6, end: 1102.0, text: "And one final word. If you're sitting there listening to me thinking I understand, but I'm not very good at sports. I'd say to you, it really doesn't matter because when you graduate and start writing a resume for a job, the employer doesn't need to know if you won every competition you entered or that you were the best player on the team.", section: 3 },
  { start: 1102.4, end: 1126.0, text: "They just need to know that you took part and learned certain skills from the experience, which you can transfer into your career. So when you leave this room today, I'd ask you all to go sign up for any of the sports clubs and teams that we offer and make the experience an important part of your university life.", section: 3 }
];

// ─── Exam Questions ──────────────────────────────────────────────────────────
const LISTENING_EXAMS = [
  {
    id: 'sample-fsmept',
    title: 'Sample FSMEPT Listening Exam',
    audio: 'student/audio/listening-exam-1.mp3',
    transcript: EXAM_TRANSCRIPT,
    sections: [
      {
        title: 'Section One',
        instruction: 'Listen to an interview with archaeologist Matthew Piscitelli. Circle T (True) or F (False) for each sentence.',
        points: '5 x 1 = 5 pts',
        type: 'truefalse',
        hint: '*uncover: discover',
        questions: [
          { id: 's1q1', text: 'Archaeology encourages people to learn more about the ancient history which is helpful for our future.', answer: 'T' },
          { id: 's1q2', text: 'Piscitelli thinks that archaeologists should inform people about how important their work is.', answer: 'T' },
          { id: 's1q3', text: 'The interviewer believes that many people associate archaeology with making new discoveries of unknown cities.', answer: 'F' },
          { id: 's1q4', text: 'According to Piscitelli, Stonehenge has been recently attracting tourists because of its age.', answer: 'F' },
          { id: 's1q5', text: 'Unlike some places, the archaeological sites in Egypt have been studied quite a lot.', answer: 'T' }
        ]
      },
      {
        title: 'Section Two',
        instruction: 'Listen to a conversation about selecting a college between two friends. Choose the correct answer a, b or c.',
        points: '5 x 1 = 5 pts',
        type: 'mcq',
        questions: [
          { id: 's2q1', text: 'Liam prefers going to a college outside New York mainly because __________.',
            options: ['the other colleges offer free accommodation', 'he is thinking of choosing a rare department', "he doesn't like living in New York"], answer: 'b' },
          { id: 's2q2', text: 'Liam states that ecotourism __________.',
            options: ['helps protect the environment', 'encourages tourists to travel more', 'makes locals more educated'], answer: 'a' },
          { id: 's2q3', text: 'After university, Liam expects to get hired easily because __________.',
            options: ['ecotourism is getting more and more popular', "there aren't many people who want to save the world", 'he is interested in exploring the nature'], answer: 'a' },
          { id: 's2q4', text: 'Ecotourism guarantees that travellers __________.',
            options: ['make the best of their experience', 'are punished for their irresponsible behaviours', 'are informed about the human impacts on the environment'], answer: 'c' },
          { id: 's2q5', text: 'Which statement is NOT true about the national park in Madagascar?',
            options: ['The scenery is magnificent.', 'Travellers can easily reach the whole park.', 'It is located in a rocky area.'], answer: 'b' }
        ]
      },
      {
        title: 'Section Three',
        instruction: 'Listen to a podcast about young people and playing sports. Complete the sentences with 1 word from the audio.',
        points: '5 x 1 = 5 pts',
        type: 'fillblank',
        note: 'Exceeding the word limit will result in ZERO (0).',
        questions: [
          { id: 's3q1', text: 'The first reason to participate in college sports is __________.', answer: 'teamwork' },
          { id: 's3q2', text: 'When you play sports, __________ tend to emerge.', answer: 'leadership' },
          { id: 's3q3', text: 'Balancing all the __________ on your time is good for time management skills.', answer: 'demands' },
          { id: 's3q4', text: 'By running a sports club, you are learning the skills of __________.', answer: 'organization' },
          { id: 's3q5', text: 'Future employers will want to know what you learned from the __________.', answer: 'experience' }
        ]
      }
    ]
  }
,

  // ── Imported 2026-08-20 by tools/import-listening.js ──────────────────
  // Source: the source Word papers plus a Whisper SRT per exam. The tool
  // asserts that every answer count matches its question count and that
  // every answer letter is one of that question own options, so a
  // half-parsed key cannot reach students.
  {
    id: "fsmept-forger",
    title: "FSMEPT Listening 1 - The Forger",
    audio: "student/audio/listening-forger.mp3",
    // 111 cues, 304.8s, timings from a Whisper SRT
    transcript: [
    { start: 0, end: 3, text: "Good evening everyone and welcome to Film Strip.", section: 1 },
    { start: 3, end: 5.8, text: "Tonight we go behind the scenes on the new movie,", section: 1 },
    { start: 5.8, end: 9.3, text: "The Forger, which will be in cinemas later this year.", section: 1 },
    { start: 9.3, end: 11.9, text: "The Forger is a remarkable true story", section: 1 },
    { start: 11.9, end: 15.9, text: "about one of the biggest art forgery crimes in history.", section: 1 },
    { start: 15.9, end: 18.7, text: "The hero of the film is John Myatt.", section: 1 },
    { start: 18.7, end: 21.6, text: "When the film starts, Myatt is a school teacher", section: 1 },
    { start: 21.6, end: 24.2, text: "in Staffordshire in central England.", section: 1 },
    { start: 24.2, end: 26.2, text: "Myatt is a frustrated artist.", section: 1 },
    { start: 26.2, end: 28.6, text: "He went to art school, but was never able", section: 1 },
    { start: 28.6, end: 30.9, text: "to make enough money from his painting.", section: 1 },
    { start: 30.9, end: 33.9, text: "One day, he comes home early to find his wife", section: 1 },
    { start: 33.9, end: 35.3, text: "with another man.", section: 1 },
    { start: 35.3, end: 37.6, text: "She leaves him and their two children,", section: 1 },
    { start: 37.6, end: 41.8, text: "and Myatt soon finds himself overworked and broke.", section: 1 },
    { start: 41.8, end: 43.9, text: "Now, Myatt is not a great painter,", section: 1 },
    { start: 43.9, end: 45.9, text: "but he's a brilliant imitator.", section: 1 },
    { start: 45.9, end: 49.9, text: "He can copy the paintings and styles of famous artists.", section: 1 },
    { start: 49.9, end: 52.2, text: "So he puts an ad in a magazine.", section: 1 },
    { start: 52.2, end: 54, text: "Let's hear the clip.", section: 1 },
    { start: 54, end: 55.4, text: "- Yes, hello.", section: 1 },
    { start: 55.4, end: 59.3, text: "I'd like to put an advertisement in next week's issue.", section: 1 },
    { start: 59.3, end: 63.9, text: "It reads, \"Genuine fakes from 150 pounds.\"", section: 1 },
    { start: 63.9, end: 65.2, text: "Yes, that's all.", section: 1 },
    { start: 65.2, end: 67.2, text: "And my phone number.", section: 1 },
    { start: 67.2, end: 70.1, text: "- There's nothing illegal about copying art.", section: 1 },
    { start: 70.1, end: 72.4, text: "A genuine fake, as Myatt called it,", section: 1 },
    { start: 72.4, end: 74.3, text: "as long as you sign it yourself", section: 1 },
    { start: 74.3, end: 76.4, text: "and don't pretend that it was really painted", section: 1 },
    { start: 76.4, end: 78.2, text: "by someone else.", section: 1 },
    { start: 78.2, end: 81, text: "Myatt's business was doing well for a few years.", section: 1 },
    { start: 81, end: 84.6, text: "He copied paintings by Monet, Clay, Nicholson,", section: 1 },
    { start: 84.6, end: 86.8, text: "famous 20th century artists,", section: 1 },
    { start: 86.8, end: 89.6, text: "and he was able to spend more time with his children,", section: 1 },
    { start: 89.6, end: 91.2, text: "Amy and Sam.", section: 1 },
    { start: 91.2, end: 94.3, text: "One of his best customers was an art collector in London", section: 1 },
    { start: 94.3, end: 96.4, text: "called John Drew.", section: 1 },
    { start: 96.4, end: 98.9, text: "Drew had bought many genuine fakes from Myatt,", section: 1 },
    { start: 98.9, end: 101.4, text: "and the two Johns had become friends.", section: 1 },
    { start: 101.4, end: 104.7, text: "Then one day, Myatt received a phone call from Drew", section: 1 },
    { start: 104.7, end: 107.6, text: "that changed both of their lives.", section: 1 },
    { start: 107.6, end: 111.4, text: "- John, do you remember the copy of the Albert Glaze painting", section: 1 },
    { start: 111.4, end: 113, text: "that you did for me recently?", section: 1 },
    { start: 113, end: 114.3, text: "- Yes, of course.", section: 1 },
    { start: 114.3, end: 115.9, text: "It took me a long time.", section: 1 },
    { start: 115.9, end: 118.2, text: "I thought it was rather good.", section: 1 },
    { start: 118.2, end: 119.9, text: "- You're not the only one.", section: 1 },
    { start: 119.9, end: 123.4, text: "Someone at Christie's yesterday thought it was very good.", section: 1 },
    { start: 123.4, end: 124.8, text: "- Christie's?", section: 1 },
    { start: 124.8, end: 126.7, text: "The auction house in London?", section: 1 },
    { start: 126.7, end: 129, text: "That's where real paintings are bought and sold,", section: 1 },
    { start: 129, end: 130.2, text: "not my fakes.", section: 1 },
    { start: 130.2, end: 132.7, text: "- Not anymore, my friend.", section: 1 },
    { start: 132.7, end: 137.7, text: "I sold your glaze as a genuine glaze for 25,000 pounds.", section: 1 },
    { start: 137.7, end: 141.4, text: "- You did what?", section: 1 },
    { start: 141.4, end: 143.4, text: "But they'll find out it's a fake.", section: 1 },
    { start: 143.4, end: 144.6, text: "(John laughs)", section: 1 },
    { start: 144.6, end: 147, text: "- No, they won't, John.", section: 1 },
    { start: 147, end: 150.6, text: "I wrote some documents to give the painting a history.", section: 1 },
    { start: 150.6, end: 153.8, text: "Old paper, old typewriter, who cares?", section: 1 },
    { start: 153.8, end: 155.6, text: "The buyer likes the painting.", section: 1 },
    { start: 155.6, end: 157.6, text: "He thinks he has an original,", section: 1 },
    { start: 157.6, end: 161.9, text: "and you've earned 12,500 pounds.", section: 1 },
    { start: 161.9, end: 163.3, text: "Come to London.", section: 1 },
    { start: 163.3, end: 166.1, text: "I'll give you your money, cash, of course,", section: 1 },
    { start: 166.1, end: 169.8, text: "and we can discuss our next project.", section: 1 },
    { start: 169.8, end: 172, text: "- I don't know, John.", section: 1 },
    { start: 172, end: 174, text: "This can't be legal.", section: 1 },
    { start: 174, end: 177.1, text: "- How much do you earn as a teacher, John?", section: 1 },
    { start: 177.1, end: 179.6, text: "- About 13,000.", section: 1 },
    { start: 179.6, end: 183.4, text: "- You've just nearly doubled your salary.", section: 1 },
    { start: 183.4, end: 186.3, text: "- How can Mayotte resist an offer like that?", section: 1 },
    { start: 186.3, end: 190, text: "Almost $25,000 for a forgery?", section: 1 },
    { start: 190, end: 191, text: "He can't.", section: 1 },
    { start: 191, end: 192.6, text: "And over the next few years,", section: 1 },
    { start: 192.6, end: 196.4, text: "Drew and Mayotte sell one million pounds.", section: 1 },
    { start: 196.4, end: 199.6, text: "That's nearly $2 million of fake art", section: 1 },
    { start: 199.6, end: 202.7, text: "to dealers and museums all over the world,", section: 1 },
    { start: 202.7, end: 207.7, text: "including a Giacometti which sold for $300,000 in New York.", section: 1 },
    { start: 207.7, end: 211.8, text: "Drew is the brains behind the operation.", section: 1 },
    { start: 211.8, end: 213.8, text: "At one point, he tells Mayotte", section: 1 },
    { start: 213.8, end: 216.1, text: "that he's not doing it for the money.", section: 1 },
    { start: 216.1, end: 218.9, text: "For Drew, forgery is a game.", section: 1 },
    { start: 218.9, end: 222.2, text: "He wants to trick people into paying for a fake", section: 1 },
    { start: 222.2, end: 224.2, text: "as if it were genuine.", section: 1 },
    { start: 224.2, end: 227.5, text: "He goes to extraordinary lengths in his deception.", section: 1 },
    { start: 227.5, end: 231.4, text: "For example, he tricks his way into two top art museums", section: 1 },
    { start: 231.4, end: 233.3, text: "in London and leaves photographs", section: 1 },
    { start: 233.3, end: 236.2, text: "of the fake paintings in old catalogs.", section: 1 },
    { start: 236.2, end: 238.6, text: "Then when he's auctioning the painting,", section: 1 },
    { start: 238.6, end: 243.2, text: "he can go to the museum and prove that it's the real thing.", section: 1 },
    { start: 243.2, end: 245.8, text: "But of course, it has to end.", section: 1 },
    { start: 245.8, end: 249.9, text: "You might remember the court trial in the late 1990s.", section: 1 },
    { start: 249.9, end: 252, text: "Drew was so good at forgery", section: 1 },
    { start: 252, end: 255.8, text: "that he faked two heart attacks to delay the trial.", section: 1 },
    { start: 255.8, end: 260.4, text: "Eventually though, both Drew and Mayotte were sent to prison.", section: 1 },
    { start: 260.4, end: 262.6, text: "Drew was there for six years,", section: 1 },
    { start: 262.6, end: 264.6, text: "but Mayotte cooperated with the police", section: 1 },
    { start: 264.6, end: 267.9, text: "and he was only imprisoned for four months.", section: 1 },
    { start: 267.9, end: 270.4, text: "The judge recognized that Drew was the one", section: 1 },
    { start: 270.4, end: 272.8, text: "who was really committing the forgery.", section: 1 },
    { start: 272.8, end: 275, text: "I won't tell you the twist to the story", section: 1 },
    { start: 275, end: 277.1, text: "after Mayotte gets out of prison.", section: 1 },
    { start: 277.1, end: 280.7, text: "It's almost too good to be true, but it is.", section: 1 },
    { start: 280.7, end: 283.7, text: "We will tell you that Mayotte became more famous", section: 1 },
    { start: 283.7, end: 285.6, text: "because of all of the publicity", section: 1 },
    { start: 285.6, end: 289.5, text: "and that he now sells his genuine fakes, properly labeled,", section: 1 },
    { start: 289.5, end: 292.7, text: "for up to $10,000.", section: 1 },
    { start: 292.7, end: 295.5, text: "How much money did Mayotte make for his forgeries?", section: 1 },
    { start: 295.5, end: 300.5, text: "About $26,000 a year, about the same as his teaching salary.", section: 1 },
    { start: 300.5, end: 304.8, text: "The forgery hits the big screen later this year.", section: 1 }
    ],
    sections: [
    {
      "title": "Part A",
      "instruction": "Mark the sentences True or False.",
      "points": "6 x 1 = 6 pts",
      "type": "truefalse",
      "questions": [
        {
          "id": "a1",
          "text": "The Forger is a film about how a school teacher becomes an creative artist.",
          "answer": "F"
        },
        {
          "id": "a2",
          "text": "Copying someone else’s work was considered illegal unless you signed your own name under it.",
          "answer": "T"
        },
        {
          "id": "a3",
          "text": "Myatt only copied paintings of 20th century artists.",
          "answer": "F"
        },
        {
          "id": "a4",
          "text": "John Drewe sold one of Myatt’s painting in an auction not knowing that it was a copy.",
          "answer": "F"
        },
        {
          "id": "a5",
          "text": "Drewe was mainly interested in the thrill of selling copies rather than the money.",
          "answer": "T"
        },
        {
          "id": "a6",
          "text": "At the end of the film, Wyatt was not sentenced because he cooperated with the police.",
          "answer": "F"
        }
      ]
    },
    {
      "title": "Part B",
      "instruction": "Choose the correct option.",
      "points": "10 x 1 = 10 pts",
      "type": "mcq",
      "questions": [
        {
          "id": "b1",
          "text": "What is the movie The Forger based on?",
          "options": [
            "a real event",
            "a book",
            "a painting",
            "a newspaper ad"
          ],
          "answer": "a"
        },
        {
          "id": "b2",
          "text": "Which of these people is the artist who painted the forgeries?",
          "options": [
            "John Drewe",
            "John Myatt",
            "Albert Gleizes",
            "John Christie"
          ],
          "answer": "b"
        },
        {
          "id": "b3",
          "text": "At the beginning of the movie, what is John Myatt’s job?",
          "options": [
            "professional artist",
            "auctioneer",
            "a newspaper journalist",
            "teacher"
          ],
          "answer": "d"
        },
        {
          "id": "b4",
          "text": "What does Myatt decide to do after his wife leaves him?",
          "options": [
            "move to London and get a new job.",
            "sell forgeries of famous paintings at auctions.",
            "make genuine copies of famous paintings and sell them in his name.",
            "spend more time with his children"
          ],
          "answer": "c"
        },
        {
          "id": "b5",
          "text": "Who was John Drewe?",
          "options": [
            "an art collector",
            "a forger",
            "a friend of Myatt’s wife",
            "an art teacher"
          ],
          "answer": "a"
        },
        {
          "id": "b6",
          "text": "What does Drewe do?",
          "options": [
            "He paints forged art and sells it.",
            "He sells Myatt’s paintings as forgeries and keeps the money.",
            "He owns an auction house and he buys and sells genuine paintings there.",
            "He sells Myatt’s paintings as forgeries and splits the money with Myatt."
          ],
          "answer": "d"
        },
        {
          "id": "b7",
          "text": "Why does Drewe trick his way into art museums?",
          "options": [
            "He wants to steal paintings and sell them.",
            "He wants to photograph the paintings for Myatt to copy.",
            "He wants to leave false documentation of forgeries.",
            "He wants to see the paintings and sculptors there."
          ],
          "answer": "c"
        },
        {
          "id": "b8",
          "text": "What happened before Drewe’s first trial?",
          "options": [
            "Drewe faked a heart attack.",
            "Drewe had a heart attack.",
            "Drewe was sent to prison.",
            "Drewe cooperated with the police."
          ],
          "answer": "a"
        },
        {
          "id": "b9",
          "text": "Which of the following is a reason that Myatt received a shorter prison sentence than Drewe?",
          "options": [
            "He faked two heart attacks.",
            "He had two children.",
            "He tried to trick people into buying the paintings.",
            "He cooperated with the police."
          ],
          "answer": "d"
        },
        {
          "id": "b10",
          "text": "What did Myatt do after he left prison?",
          "options": [
            "He continues teaching.",
            "He made more forgeries.",
            "He sold genuine fakes again.",
            "He started telling stories."
          ],
          "answer": "c"
        }
      ]
    }
  ]
  },

  {
    id: "fsmept-best-places",
    title: "FSMEPT Listening 4 - The Best Places to Live in the US",
    audio: "student/audio/listening-best-places.mp3",
    // 53 cues, 291.4s, timings from a Whisper SRT
    transcript: [
    { start: 0, end: 10.8, text: "WTVA Action News at 6. I'm Drew Grant. Our lead story this evening, it's official. You", section: 1 },
    { start: 10.8, end: 17.9, text: "live in the best place in America. Every year, City Select Magazine lists the best places", section: 1 },
    { start: 17.9, end: 23.6, text: "to live in the United States. And this year, number one is right here in Charlottesville,", section: 1 },
    { start: 23.6, end: 28.9, text: "Virginia. Our reporter, Roberta Jackson, explains why.", section: 1 },
    { start: 28.9, end: 33.5, text: "When it comes to naming the best place to live in America, you might expect to see places", section: 1 },
    { start: 33.5, end: 39.3, text: "like New York City, Seattle, or San Francisco at the top of the list. But according to Kevin", section: 1 },
    { start: 39.3, end: 45.5, text: "Ingalls, editor of City Select Magazine, you need look no further than Charlottesville.", section: 1 },
    { start: 45.5, end: 50.1, text: "Among the advantages of living here, Ingalls says, are that Charlottesville has little", section: 1 },
    { start: 50.1, end: 56.2, text: "suburban sprawl and a beautiful natural environment in the foothills of the Blue Ridge Mountains.", section: 1 },
    { start: 56.2, end: 61.6, text: "Let's face it, who wouldn't want to live here during fall's amazing changing colors?", section: 1 },
    { start: 61.6, end: 65.9, text: "Or in winter with its perfect ski season, in spring when the flowers are blooming with", section: 1 },
    { start: 65.9, end: 70.8, text: "life, or even in summer when you can escape the humidity of the East Coast? And as the", section: 1 },
    { start: 70.8, end: 76.7, text: "home of the University of Virginia, Charlottesville has all the recreational and educational opportunities", section: 1 },
    { start: 76.7, end: 81, text: "you could want in a small town. I'm standing here with Kenny Flint, a college", section: 1 },
    { start: 81, end: 86.1, text: "student and Charlottesville resident. Kenny, how did you decide to come to Charlottesville?", section: 1 },
    { start: 86.1, end: 93.4, text: "I grew up in New York City, concrete everywhere, air, pollution, all that traffic, you know.", section: 1 },
    { start: 93.4, end: 98.6, text: "Here I'm in the countryside, I look out my window at mountains. I feel closer to nature", section: 1 },
    { start: 98.6, end: 101.8, text: "in Charlottesville than I ever did back in New York.", section: 1 },
    { start: 101.8, end: 105.6, text: "But there's nature in New York too. What about Central Park?", section: 1 },
    { start: 105.6, end: 112.6, text: "Yeah, that's a great park with the lake and fountains and the art museums. But it's so", section: 1 },
    { start: 112.6, end: 118.7, text: "planned, you know? There are busy roads on all sides, so it's like man-made nature, and", section: 1 },
    { start: 118.7, end: 125.2, text: "I live miles from Central Park. I had to drive or take the subway there. Nature here in Charlottesville", section: 1 },
    { start: 125.2, end: 129.8, text: "is all around, and it's really natural. It's wild.", section: 1 },
    { start: 129.8, end: 134.2, text: "But does the natural beauty of the environment ever distract you from your studies?", section: 1 },
    { start: 134.2, end: 139.7, text: "Well, I've got to tell you. Sometimes I'm sitting in class and I look out at the trees", section: 1 },
    { start: 139.7, end: 142.4, text: "and mountains and my mind drifts off.", section: 1 },
    { start: 142.4, end: 147.1, text: "When choosing its winner each year, City Select also looks at the cost of living and the cost", section: 1 },
    { start: 147.1, end: 152.1, text: "of buying houses. Charlottesville's house prices are quite high, but the cost of living", section: 1 },
    { start: 152.1, end: 157.6, text: "is low, so this is a very affordable city. Of course, now that the secret's out, everyone", section: 1 },
    { start: 157.6, end: 160, text: "is going to want to move to Charlottesville.", section: 1 },
    { start: 160, end: 166.6, text: "Reporting live from Charlottesville, I'm Roberta Jackson. Back to you in the studio, Drew.", section: 1 },
    { start: 166.6, end: 172.9, text: "Thank you, Roberta. This announcement by City Select is not all good news, though. The number", section: 1 },
    { start: 172.9, end: 179.9, text: "one city on the list a few years ago was Ann Arbor, Michigan. Ann Arbor, like Charlottesville,", section: 1 },
    { start: 179.9, end: 185.8, text: "is a college town with a high standard of living, good public schools, and lots of natural", section: 1 },
    { start: 185.8, end: 189.1, text: "beauty, so many people moved there.", section: 1 },
    { start: 189.1, end: 194.9, text: "The increase in population has caused some new problems. There are now more cars, which", section: 1 },
    { start: 194.9, end: 200.8, text: "means that there is more air pollution and more damage to the roads. Another problem", section: 1 },
    { start: 200.8, end: 207.6, text: "in Ann Arbor is sprawl. As the city has become busier, both new and old residents have moved", section: 1 },
    { start: 207.6, end: 213.9, text: "out, bringing pollution and traffic to suburbs and nearby villages. The increase in demand", section: 1 },
    { start: 213.9, end: 217.9, text: "for houses also pushed up the price of buying a home.", section: 1 },
    { start: 217.9, end: 223.4, text: "For more on this aspect of the story, we turn to a city planner here in Charlottesville,", section: 1 },
    { start: 223.4, end: 228.3, text: "Fiona Maxwell. Fiona, can we handle an increase in population?", section: 1 },
    { start: 228.3, end: 235.9, text: "Yes and no. We have enough space to expand without creating sprawl and without destroying", section: 1 },
    { start: 235.9, end: 243.6, text: "parkland. However, house prices in Charlottesville are already high, and we're going to need", section: 1 },
    { start: 243.6, end: 249.8, text: "greater housing diversity if the city expands. This is an exciting opportunity, but it would", section: 1 },
    { start: 249.8, end: 254.9, text: "be a shame if the cost of living here becomes so high that many people can't afford to live", section: 1 },
    { start: 254.9, end: 257.6, text: "in the best place in America.", section: 1 },
    { start: 257.6, end: 262.6, text: "One more question, Fiona. Which city would you choose as the best in America?", section: 1 },
    { start: 262.6, end: 268.9, text: "Well, I live here too, so I would of course say Charlottesville. But I think the big cities", section: 1 },
    { start: 268.9, end: 274.7, text: "can be great places to live too. Atlanta, for example, is a very well planned city,", section: 1 },
    { start: 274.7, end: 279.5, text: "and it's very affordable. But I still wouldn't move there.", section: 1 },
    { start: 279.5, end: 285.3, text: "Thank you, Fiona. So it sounds like this announcement may turn out to be a double edged sword for", section: 1 },
    { start: 285.3, end: 291.4, text: "our town. I guess we'll find out. For more on this story, be sure to check our website", section: 1 }
    ],
    sections: [
    {
      "title": "Part A",
      "instruction": "Mark the sentences True or False.",
      "points": "6 x 1 = 6 pts",
      "type": "truefalse",
      "questions": [
        {
          "id": "a1",
          "text": "According to City Select Magazine, the best place to live in the US is New York.",
          "answer": "F"
        },
        {
          "id": "a2",
          "text": "The natural features of Charlottesville are what make it advantageous to live there.",
          "answer": "T"
        },
        {
          "id": "a3",
          "text": "Kenny Flint moved to Charlottesville because there was nothing but concrete in New York City.",
          "answer": "F"
        },
        {
          "id": "a4",
          "text": "The cost of living in Charlottesville is very high.",
          "answer": "F"
        },
        {
          "id": "a5",
          "text": "Ann Arbor used to be the best place to live a few years ago.",
          "answer": "T"
        },
        {
          "id": "a6",
          "text": "Fiona thinks that Atlanta is the best city to live in the US.",
          "answer": "F"
        }
      ]
    },
    {
      "title": "Part B",
      "instruction": "Choose the correct option.",
      "points": "11 x 1 = 11 pts",
      "type": "mcq",
      "questions": [
        {
          "id": "b1",
          "text": "Which is the best place to live in America this year?",
          "options": [
            "Ann Arbor, Michigan",
            "Charlottesville, Virginia",
            "Atlanta, Georgia"
          ],
          "answer": "b"
        },
        {
          "id": "b2",
          "text": "Why is this not necessarily good news for the city that was chosen?",
          "options": [
            "Too many people may move to the city.",
            "Too many reporters will visit the city.",
            "The value of homes will drop."
          ],
          "answer": "a"
        },
        {
          "id": "b3",
          "text": "What is the name of the magazine that lists the top places to live?",
          "options": [
            "Kevin Ingles",
            "City Select",
            "Best Places"
          ],
          "answer": "b"
        },
        {
          "id": "b4",
          "text": "Which of the following is mentioned as an advantage of living in Charlottesville?",
          "options": [
            "good shopping",
            "low house prices",
            "beautiful nature"
          ],
          "answer": "c"
        },
        {
          "id": "b5",
          "text": "Why is summer a good season in Charlottesville?",
          "options": [
            "It’s not very humid.",
            "You can go water-skiing.",
            "There are too many colorful flowers."
          ],
          "answer": "a"
        },
        {
          "id": "b6",
          "text": "Who is Kenny Flint?",
          "options": [
            "a city planner",
            "a student",
            "a reporter"
          ],
          "answer": "b"
        },
        {
          "id": "b7",
          "text": "What does Kenny not like about Central Park?",
          "options": [
            "There is a lot of pollution.",
            "There are too many tourists.",
            "It is too planned and man-made."
          ],
          "answer": "c"
        },
        {
          "id": "b8",
          "text": "Which of the following is a disadvantage of living in Charlottesville?",
          "options": [
            "house prices",
            "cost of living",
            "sprawl"
          ],
          "answer": "a"
        },
        {
          "id": "b9",
          "text": "Why does the newscaster mention Ann Arbor?",
          "options": [
            "It was number two on the list this year.",
            "It was number one on the list previously.",
            "It is another city in Virginia."
          ],
          "answer": "b"
        },
        {
          "id": "b10",
          "text": "What negative effect did the increase in population cause in Ann Arbor?",
          "options": [
            "poor public schools",
            "more crime",
            "increase in house prices"
          ],
          "answer": "c"
        },
        {
          "id": "b11",
          "text": "The newscaster ends the broadcast by saying that this announcement could be a ‘double-edged sword’. What does he mean?",
          "options": [
            "The advantages might be greater than the disadvantages.",
            "It might be both good and bad for the city.",
            "It might just be bad for the city."
          ],
          "answer": "b"
        }
      ]
    }
  ]
  }
,

  {
    id: "fsmept-museum",
    title: "FSMEPT Listening 5 - Museum of Science and Technology",
    audio: "student/audio/listening-museum.mp3",
    // 60 cues, 278s, Whisper SRT; 99.5% word
    // agreement with the human transcript. True/false only - this paper has
    // no multiple-choice part and no PART headers at all.
    transcript: [
    { start: 0, end: 4, text: "Okay, everyone, if you'd like to come over here to our next exhibit.", section: 1 },
    { start: 4, end: 9, text: "Okay, so we're continuing to learn about the history of the home computer.", section: 1 },
    { start: 9, end: 12, text: "Now, does anyone recognize this amazing machine?", section: 1 },
    { start: 12, end: 17, text: "No? Well, anyone who grew up in Britain in the 1980s would immediately recognize this.", section: 1 },
    { start: 17, end: 22, text: "It's the famous BBC microcomputer. You've all heard of the BBC, right?", section: 1 },
    { start: 22, end: 25, text: "Well, of course. It's the television company in England.", section: 1 },
    { start: 25, end: 32, text: "The British Broadcasting Corporation, or BBC, is Britain's national, state-run television and radio network.", section: 1 },
    { start: 32, end: 34, text: "So why did a TV station make a computer?", section: 1 },
    { start: 34, end: 39, text: "That's a really interesting story. It starts in the early 1980s.", section: 1 },
    { start: 39, end: 46, text: "BBC television showed a program called The Mighty Micro, in which a professor, his name was Dr. Christopher Evans,", section: 1 },
    { start: 46, end: 53, text: "he predicted the importance of the microcomputer, what we today just call the computer or the personal computer.", section: 1 },
    { start: 53, end: 59, text: "Now, you have to remember that in 1980, there were no computers in homes, in schools, in libraries.", section: 1 },
    { start: 59, end: 65, text: "Computers were big and expensive, so they still weren't something that a family or a student would go out and buy.", section: 1 },
    { start: 65, end: 69, text: "But Dr. Evans made a prediction, a guess about the future.", section: 1 },
    { start: 69, end: 72, text: "He predicted that computers were going to get smaller.", section: 1 },
    { start: 72, end: 78, text: "Technology was making it possible to build a whole computer in a box that could fit on your desk.", section: 1 },
    { start: 78, end: 82, text: "That's why the first home computers were called microcomputers.", section: 1 },
    { start: 82, end: 84, text: "Micro meaning small.", section: 1 },
    { start: 84, end: 89, text: "Okay, so, um, Evans argued that the microcomputer was going to change everything,", section: 1 },
    { start: 89, end: 95, text: "and that Britain's children needed to learn how to use a computer in order to be prepared for the future.", section: 1 },
    { start: 95, end: 99, text: "Now, it just so happened that a lot of important people watched that program,", section: 1 },
    { start: 99, end: 103, text: "and Evans' predictions caught the attention of many people in Britain.", section: 1 },
    { start: 103, end: 110, text: "In fact, even the British Parliament, the government, ended up discussing the program and Evans' predictions.", section: 1 },
    { start: 110, end: 117, text: "So the BBC decided to start a new project to build a computer that was affordable, but that had lots of functions.", section: 1 },
    { start: 117, end: 124, text: "Text, graphics, sound, music, programming, even artificial intelligence.", section: 1 },
    { start: 124, end: 130, text: "The BBC planned to sell its microcomputer to homes and especially schools around the country.", section: 1 },
    { start: 130, end: 133, text: "So the BBC made the actual computer?", section: 1 },
    { start: 133, end: 134, text: "No, actually they didn't.", section: 1 },
    { start: 134, end: 142, text: "The BBC was, and still is, in the business of making television and radio programs, not computers.", section: 1 },
    { start: 142, end: 148, text: "So they wanted to find a computer company that could make the computer and put the BBC's name on it.", section: 1 },
    { start: 148, end: 155, text: "In Cambridge, England, home to the famous old university, a small company called Acorn heard about the project.", section: 1 },
    { start: 155, end: 162, text: "It just so happened that Acorn was already making its first computer, but it wasn't quite finished yet.", section: 1 },
    { start: 162, end: 166, text: "The Acorn employees worked through the night and finished that first computer.", section: 1 },
    { start: 166, end: 168, text: "It was called the Proton.", section: 1 },
    { start: 168, end: 173, text: "They showed their brand new creation to the BBC and won the contract.", section: 1 },
    { start: 173, end: 178, text: "It's really an amazing story of a small company beating all the bigger corporations.", section: 1 },
    { start: 178, end: 184, text: "The first BBC computer, they called it the Model A, came out in 1981.", section: 1 },
    { start: 184, end: 188, text: "And the Model B came out not too long afterward.", section: 1 },
    { start: 188, end: 190, text: "And that's the computer you can see here.", section: 1 },
    { start: 190, end: 193, text: "The BBC Model B microcomputer.", section: 1 },
    { start: 193, end: 201, text: "The computer was an immediate success, mainly because schools in Britain bought many of them to teach computer skills to students.", section: 1 },
    { start: 201, end: 204, text: "Excuse me, what could you do with a computer like this?", section: 1 },
    { start: 204, end: 206, text: "I mean, what was it capable of?", section: 1 },
    { start: 206, end: 214, text: "Well, the B, that's the nickname for the BBC Model B microcomputer, was an amazing computer for its time.", section: 1 },
    { start: 214, end: 219, text: "You could write programs, draw pictures in eight colors, write music.", section: 1 },
    { start: 219, end: 222, text: "The computer could even speak words in English.", section: 1 },
    { start: 222, end: 224, text: "And you could play games.", section: 1 },
    { start: 224, end: 229, text: "Today you would find them very simple, but they were pretty cool in the early 80s.", section: 1 },
    { start: 229, end: 232, text: "There was also a lot of educational software.", section: 1 },
    { start: 232, end: 237, text: "Programs that taught children English, math, science, and history.", section: 1 },
    { start: 237, end: 243, text: "Math teachers loved the BBC Buggy, a robot that you could control using a BBC computer.", section: 1 },
    { start: 243, end: 247, text: "And of course you could use the computer for word processing.", section: 1 },
    { start: 247, end: 251, text: "It was really new for most kids to type their essays and then print them.", section: 1 },
    { start: 251, end: 253, text: "It was very exciting.", section: 1 },
    { start: 253, end: 256, text: "Was the BBC computer used in elementary schools?", section: 1 },
    { start: 256, end: 259, text: "Eventually, yes, but not at first.", section: 1 },
    { start: 259, end: 264, text: "I have British friends who first used this computer when they were in middle or high school.", section: 1 },
    { start: 264, end: 266, text: "Things have certainly changed, right?", section: 1 },
    { start: 266, end: 271, text: "I mean, nowadays some children are using computers even before they go to elementary school.", section: 1 },
    { start: 271, end: 278, text: "Okay, any more questions before we move on to the next exhibit?", section: 1 }
    ],
    sections: [
    {
      "title": "Part A",
      "instruction": "Mark the sentences True or False.",
      "points": "6 x 1 = 6 pts",
      "type": "truefalse",
      "questions": [
        {
          "id": "a1",
          "text": "After the BBC showed the program “The Mighty Micro,” people in Britain became interested in small computers.",
          "answer": "T"
        },
        {
          "id": "a2",
          "text": "Dr. Christopher Evans predicted computers would become less compact.",
          "answer": "F"
        },
        {
          "id": "a3",
          "text": "The BBC wanted to design a microcomputer that was affordable.",
          "answer": "T"
        },
        {
          "id": "a4",
          "text": "Acorn beat other larger businesses and won a contract with the BBC.",
          "answer": "T"
        },
        {
          "id": "a5",
          "text": "The first BBC computer was invented in 1981.",
          "answer": "T"
        },
        {
          "id": "a6",
          "text": "The BBC computer was always used in elementary school.",
          "answer": "F"
        }
      ]
    }
  ]
  },

  {
    id: "fsmept-news-media",
    title: "FSMEPT Listening 2 - News Media",
    audio: "student/audio/listening-news-media.mp3",
    // 156 cues, 587s, Whisper SRT; 98.5% word agreement with the human
    // transcript. Part A is GAP-FILL, not true/false - the only paper of the
    // five that is. Part B prints its options with no "a." prefix, so the
    // importer recovered the grouping by block size, cross-checked against
    // the answer key (45 lines / 9 answers = 1 question + 4 options).
    transcript: [
    { start: 0.14, end: 5.14, text: "Chapter 7, Lecture.", section: 1 },
    { start: 5.14, end: 8.14, text: "Alright, let's get going.", section: 1 },
    { start: 8.14, end: 11.14, text: "I've got a lot of material to get through today.", section: 1 },
    { start: 11.14, end: 15.14, text: "So, let's go back to our discussion of the news media", section: 1 },
    { start: 15.14, end: 17.14, text: "and how people get their news.", section: 1 },
    { start: 17.14, end: 21.14, text: "And yeah, this turns out to be a very interesting topic", section: 1 },
    { start: 21.14, end: 23.14, text: "because we are seeing a significant change", section: 1 },
    { start: 23.14, end: 26.14, text: "in the way people get their news these days.", section: 1 },
    { start: 26.14, end: 29.14, text: "And it's important to note that this change,", section: 1 },
    { start: 29.14, end: 32.14, text: "like so many other trends we see today,", section: 1 },
    { start: 32.14, end: 36.14, text: "has a lot to do with the Internet.", section: 1 },
    { start: 36.14, end: 39.14, text: "So what I want to do today is I want to cover", section: 1 },
    { start: 39.14, end: 41.14, text: "several aspects of this trend", section: 1 },
    { start: 41.14, end: 46.14, text: "and talk about what this means for news.", section: 1 },
    { start: 46.14, end: 49.14, text: "Now we see the number of people actually getting the news", section: 1 },
    { start: 49.14, end: 51.14, text: "from print media is declining.", section: 1 },
    { start: 51.14, end: 54.14, text: "It's dropping.", section: 1 },
    { start: 54.14, end: 58.14, text: "And the Internet is quickly becoming an important source", section: 1 },
    { start: 58.14, end: 60.14, text: "for more and more people.", section: 1 },
    { start: 60.14, end: 63.14, text: "Okay? Great.", section: 1 },
    { start: 63.14, end: 68.14, text: "Now, let me move on to give you some statistics on this trend.", section: 1 },
    { start: 68.14, end: 71.14, text: "I want you to pay attention to this.", section: 1 },
    { start: 71.14, end: 74.14, text: "Researchers noticed that in 2000,", section: 1 },
    { start: 74.14, end: 77.14, text: "about 70% of the people they asked", section: 1 },
    { start: 77.14, end: 79.14, text: "said that newspapers were an important source", section: 1 },
    { start: 79.14, end: 81.14, text: "of information for them.", section: 1 },
    { start: 81.14, end: 85.14, text: "So 70% said reading the paper was important.", section: 1 },
    { start: 85.14, end: 91.14, text: "In 2003, that number dropped to 51%.", section: 1 },
    { start: 91.14, end: 94.14, text: "51%.", section: 1 },
    { start: 94.14, end: 97.14, text: "That's a pretty significant decline.", section: 1 },
    { start: 97.14, end: 101.14, text: "And I'm willing to bet that that number is even lower now.", section: 1 },
    { start: 101.14, end: 106.14, text: "So now I'm looking at this room full of college students.", section: 1 },
    { start: 106.14, end: 109.14, text: "Most of you are between 18 and 24.", section: 1 },
    { start: 109.14, end: 112.14, text: "And my guess is that most or maybe all of you", section: 1 },
    { start: 112.14, end: 114.14, text: "use the Internet.", section: 1 },
    { start: 114.14, end: 118.14, text: "The reason I'm talking about your age group", section: 1 },
    { start: 118.14, end: 123.14, text: "is that you represent the new trend away from newspapers", section: 1 },
    { start: 123.14, end: 125.14, text: "and toward the Internet.", section: 1 },
    { start: 125.14, end: 127.14, text: "You are the trend.", section: 1 },
    { start: 127.14, end: 130.14, text: "And experts predict that this trend away,", section: 1 },
    { start: 130.14, end: 133.14, text: "this trend away from newspapers,", section: 1 },
    { start: 133.14, end: 136.14, text: "will continue as more and more young people grow up", section: 1 },
    { start: 136.14, end: 140.14, text: "using the Internet to do so many things.", section: 1 },
    { start: 140.14, end: 143.14, text: "Let me spell this out a little more for you.", section: 1 },
    { start: 143.14, end: 148.14, text: "There was a key study of young people done in 2004.", section: 1 },
    { start: 148.14, end: 153.14, text: "And for this study, they interviewed 35 to 54-year-olds", section: 1 },
    { start: 153.14, end: 155.14, text: "who read the newspaper.", section: 1 },
    { start: 155.14, end: 157.14, text: "And they asked them if the newspaper", section: 1 },
    { start: 157.14, end: 160.14, text: "was an important part of their day.", section: 1 },
    { start: 160.14, end: 164.14, text: "Well, 38% of them said yes.", section: 1 },
    { start: 164.14, end: 171.14, text: "But, but, when they asked 18 to 24-year-old newspaper readers", section: 1 },
    { start: 171.14, end: 175.14, text: "the same question, the same question,", section: 1 },
    { start: 175.14, end: 179.14, text: "only 17% of them said yes.", section: 1 },
    { start: 179.14, end: 183.14, text: "Only 17%.", section: 1 },
    { start: 183.14, end: 186.14, text: "This is big news.", section: 1 },
    { start: 186.14, end: 188.14, text: "All right.", section: 1 },
    { start: 188.14, end: 191.14, text: "So to be sure, there is a move away from the traditional way", section: 1 },
    { start: 191.14, end: 194.14, text: "that people have gotten in use.", section: 1 },
    { start: 194.14, end: 195.14, text: "Okay.", section: 1 },
    { start: 195.14, end: 199.14, text: "Let's move on to why this trend is happening.", section: 1 },
    { start: 199.14, end: 202.14, text: "So why?", section: 1 },
    { start: 202.14, end: 206.14, text: "Now, many young people say that they prefer Internet news", section: 1 },
    { start: 206.14, end: 209.14, text: "because it's a fast way to keep up with events.", section: 1 },
    { start: 209.14, end: 211.14, text: "Now, that's probably true.", section: 1 },
    { start: 211.14, end: 214.14, text: "But there are a couple of other significant reasons", section: 1 },
    { start: 214.14, end: 218.14, text: "why news on the Internet is gaining popularity.", section: 1 },
    { start: 218.14, end: 224.14, text: "One is simply that news on the Internet is more up-to-date.", section: 1 },
    { start: 224.14, end: 227.14, text: "It's the most current information.", section: 1 },
    { start: 227.14, end: 232.14, text: "That's a significant difference from the news you read", section: 1 },
    { start: 232.14, end: 235.14, text: "in the newspaper that comes out once a day", section: 1 },
    { start: 235.14, end: 238.14, text: "and stays the same for 24 hours.", section: 1 },
    { start: 238.14, end: 241.14, text: "Now, a second feature of Internet news is", section: 1 },
    { start: 241.14, end: 244.14, text: "it gives people the ability to get informed", section: 1 },
    { start: 244.14, end: 246.14, text: "about any kind of news--", section: 1 },
    { start: 246.14, end: 249.14, text: "weather, road events, traffic--", section: 1 },
    { start: 249.14, end: 253.14, text: "news that is more in-depth than in a newspaper.", section: 1 },
    { start: 253.14, end: 263.14, text: "So the bottom line here is Internet news is more complete.", section: 1 },
    { start: 263.14, end: 266.14, text: "With an online newspaper, for example,", section: 1 },
    { start: 266.14, end: 269.14, text: "you can begin to read a news story,", section: 1 },
    { start: 269.14, end: 273.14, text: "go to a related audio or video link, and so on.", section: 1 },
    { start: 273.14, end: 276.14, text: "You can keep going and get more information.", section: 1 },
    { start: 276.14, end: 280.14, text: "Now, let's move on to another attraction of the Internet.", section: 1 },
    { start: 280.14, end: 284.14, text: "I want you to notice I keep talking about links.", section: 1 },
    { start: 284.14, end: 290.14, text: "That's because on the Internet, those links are there,", section: 1 },
    { start: 290.14, end: 294.14, text: "and you decide how much you want to learn,", section: 1 },
    { start: 294.14, end: 298.14, text: "and you decide what kind of news you want to get.", section: 1 },
    { start: 298.14, end: 303.14, text: "So the Internet is interactive.", section: 1 },
    { start: 307.14, end: 310.14, text: "In other words, there is communication", section: 1 },
    { start: 310.14, end: 314.14, text: "between the person looking for news and the website.", section: 1 },
    { start: 314.14, end: 321.14, text: "Again, you, the Internet user, control the news you get.", section: 1 },
    { start: 321.14, end: 325.14, text: "Now, I want to point out that this movement to Internet news", section: 1 },
    { start: 325.14, end: 328.14, text: "has obviously made a lot of people excited,", section: 1 },
    { start: 328.14, end: 333.14, text: "but it's also made some experts who study the media--", section: 1 },
    { start: 333.14, end: 337.14, text: "well, it's made them worried.", section: 1 },
    { start: 337.14, end: 340.14, text: "Some of their concerns are the flip side,", section: 1 },
    { start: 340.14, end: 345.14, text: "meaning the opposite of the attractions we talked about earlier.", section: 1 },
    { start: 345.14, end: 349.14, text: "For example, I mentioned that Internet news is fresh.", section: 1 },
    { start: 349.14, end: 351.14, text: "It's up to date.", section: 1 },
    { start: 351.14, end: 358.14, text: "Well, the downside, that is, the negative side of this,", section: 1 },
    { start: 358.14, end: 361.14, text: "is that reporters writing the news for the Internet", section: 1 },
    { start: 361.14, end: 365.14, text: "must work extremely quickly to research, write,", section: 1 },
    { start: 365.14, end: 369.14, text: "and get the news on the Internet as soon as possible.", section: 1 },
    { start: 369.14, end: 375.14, text: "So in this rush, rush, rush, to get the news onto the Internet,", section: 1 },
    { start: 375.14, end: 378.14, text: "it's easy for the reporters to make mistakes", section: 1 },
    { start: 378.14, end: 383.14, text: "or maybe leave out some important information.", section: 1 },
    { start: 383.14, end: 387.14, text: "So media experts are concerned that Internet news", section: 1 },
    { start: 387.14, end: 396.14, text: "might sometimes be less accurate and less reliable than newspaper news.", section: 1 },
    { start: 396.14, end: 400.14, text: "So that's one possible downside of Internet news.", section: 1 },
    { start: 400.14, end: 406.14, text: "Okay, now, here's another possible problem.", section: 1 },
    { start: 406.14, end: 408.14, text: "We said before that many Internet users", section: 1 },
    { start: 408.14, end: 412.14, text: "really enjoy controlling their news.", section: 1 },
    { start: 412.14, end: 415.14, text: "Maybe that sounded good, right?", section: 1 },
    { start: 415.14, end: 418.14, text: "But the worry for media experts is the possibility", section: 1 },
    { start: 418.14, end: 422.14, text: "that Internet users will limit their news too much.", section: 1 },
    { start: 422.14, end: 425.14, text: "They won't know everything they should.", section: 1 },
    { start: 425.14, end: 429.14, text: "Now, this is a crucial idea.", section: 1 },
    { start: 429.14, end: 433.14, text: "And the idea is that people who get their news on the Internet", section: 1 },
    { start: 433.14, end: 436.14, text: "may only learn what they want to learn", section: 1 },
    { start: 436.14, end: 441.14, text: "and miss other important information that they should know.", section: 1 },
    { start: 441.14, end: 446.14, text: "All right, now, I want to bring up another concern,", section: 1 },
    { start: 446.14, end: 449.14, text: "and it's related to the previous one.", section: 1 },
    { start: 449.14, end: 454.14, text: "It has to do with this idea of limiting what news you get on the Internet.", section: 1 },
    { start: 454.14, end: 461.14, text: "So, now, right now, let's take a look at this.", section: 1 },
    { start: 461.14, end: 464.14, text: "It's the front page of a newspaper.", section: 1 },
    { start: 464.14, end: 467.14, text: "It's a typical front page of a newspaper.", section: 1 },
    { start: 467.14, end: 471.14, text: "Here you see all kinds of news just on the front page,", section: 1 },
    { start: 471.14, end: 475.14, text: "international, national, local news.", section: 1 },
    { start: 475.14, end: 480.14, text: "And you can also find out right away what news is most important.", section: 1 },
    { start: 480.14, end: 483.14, text: "The important news has a bigger headline.", section: 1 },
    { start: 483.14, end: 486.14, text: "Here it is, at or near the top of the page.", section: 1 },
    { start: 486.14, end: 489.14, text: "And maybe it's longer.", section: 1 },
    { start: 489.14, end: 492.14, text: "Look at this headline.", section: 1 },
    { start: 492.14, end: 496.14, text: "You know by where it's at that it's the most important news.", section: 1 },
    { start: 496.14, end: 502.14, text: "It's more important than the other news.", section: 1 },
    { start: 502.14, end: 505.14, text: "But when you get the news online,", section: 1 },
    { start: 505.14, end: 509.14, text: "you tend to see something like a list, a list, you know,", section: 1 },
    { start: 509.14, end: 513.14, text: "line, line, line of headlines to choose.", section: 1 },
    { start: 513.14, end: 516.14, text: "You don't always know what's important.", section: 1 },
    { start: 516.14, end: 521.14, text: "So the worry is that Internet news readers will have much less information", section: 1 },
    { start: 521.14, end: 526.14, text: "about the important things they need to find out in today's news.", section: 1 },
    { start: 526.14, end: 531.14, text: "So what I'm saying is some experts fear that online news readers", section: 1 },
    { start: 531.14, end: 535.14, text: "will be less informed citizens who maybe, well,", section: 1 },
    { start: 535.14, end: 539.14, text: "who might not participate as much in their communities.", section: 1 },
    { start: 539.14, end: 542.14, text: "In other words, if people know less about the world around them,", section: 1 },
    { start: 542.14, end: 549.14, text: "then they might not vote, say, or help make other decisions in their communities.", section: 1 },
    { start: 549.14, end: 554.14, text: "And they just won't be as interested in the events going on around them.", section: 1 },
    { start: 554.14, end: 556.14, text: "That's the fear.", section: 1 },
    { start: 556.14, end: 560.14, text: "All right, I see our time is almost up.", section: 1 },
    { start: 560.14, end: 564.14, text: "Well, I want to stress that the trend away from newspapers to the Internet", section: 1 },
    { start: 564.14, end: 567.14, text: "is happening right in front of us.", section: 1 },
    { start: 567.14, end: 570.14, text: "And as students of the media,", section: 1 },
    { start: 570.14, end: 574.14, text: "you may or may not agree with some of the concerns of the researchers.", section: 1 },
    { start: 574.14, end: 578.14, text: "But it certainly offers us a lot to think about.", section: 1 },
    { start: 578.14, end: 581.14, text: "Okay, I'll see you guys next time.", section: 1 },
    { start: 583.14, end: 585.14, text: "[music]", section: 1 },
    { start: 585.14, end: 587.14, text: "[music]", section: 1 }
    ],
    sections: [
      {
        "title": "Part A",
        "instruction": "Complete the sentences with 1-2 words or a number.",
        "points": "7 x 1 = 7 pts",
        "type": "fillblank",
        "questions": [
          {
            "id": "a1",
            "text": "The number of people using print media is __________.",
            "answer": "declining"
          },
          {
            "id": "a2",
            "text": "Research carried out in 2000 found out that __________ of the people reported that they read the newspaper.",
            "answer": "70%"
          },
          {
            "id": "a3",
            "text": "The 2004 study showed that the newspaper was a(n) __________ of their day for 38% of people aged between 35 and 54.",
            "answer": "important part"
          },
          {
            "id": "a4",
            "text": "Internet news is becoming more widespread because it is more __________.",
            "answer": "up to date / current"
          },
          {
            "id": "a5",
            "text": "Because you can decide how much and what kind of news you want to find out about, the internet is __________.",
            "answer": "interactive"
          },
          {
            "id": "a6",
            "text": "One disadvantage of internet news is that there might be __________ in the news.",
            "answer": "mistakes"
          },
          {
            "id": "a7",
            "text": "The place of __________ on the newspaper is an indication of how important that news is.",
            "answer": "the headline"
          }
        ]
      },
      {
        "title": "Part B",
        "instruction": "Choose the correct option.",
        "points": "9 x 1 = 9 pts",
        "type": "mcq",
        "questions": [
          {
            "id": "b1",
            "text": "How are people changing how they get their news?",
            "options": [
              "People are less interested in the news",
              "The Internet is becoming a less important news source",
              "People are getting less information from print media",
              "People are unhappy with their news sources"
            ],
            "answer": "c"
          },
          {
            "id": "b2",
            "text": "College students represent",
            "options": [
              "The future of print media",
              "The trend away from print media",
              "The information age",
              "The usefulness of the internet as a news source"
            ],
            "answer": "b"
          },
          {
            "id": "b3",
            "text": "Which of the following is NOT a reason young people prefer using the Internet?",
            "options": [
              "It’s faster than newspapers",
              "It’s more accurate than newspapers",
              "It’s more up-to-date than newspapers",
              "It’s more in-depth than newspapers"
            ],
            "answer": "b"
          },
          {
            "id": "b4",
            "text": "In what way is the internet interactive?",
            "options": [
              "The user chooses what news is reported",
              "The user can add and delete news articles",
              "The user can communicate with other users",
              "The user can decide what and how much he/she wants to learn"
            ],
            "answer": "d"
          },
          {
            "id": "b5",
            "text": "Why are some media experts worried about news on the internet?",
            "options": [
              "It is too up-to-date",
              "It is written by internet reporters",
              "It may be less reliable",
              "It is putting newspapers out of business"
            ],
            "answer": "c"
          },
          {
            "id": "b6",
            "text": "What problem can arise from internet users controlling their news?",
            "options": [
              "Users may miss important information",
              "Users may not understand what they are learning",
              "Users may gain unlimited access",
              "Users may take advantage of the internet"
            ],
            "answer": "a"
          },
          {
            "id": "b7",
            "text": "On a newspaper, more important news",
            "options": [
              "Is near the bottom of the page",
              "Has a bigger headline",
              "Is in the international section",
              "Is on the inside pages"
            ],
            "answer": "b"
          },
          {
            "id": "b8",
            "text": "Lists of headlines on the internet may cause",
            "options": [
              "More people to read the news",
              "Less people to read the news",
              "People to become lazy",
              "Less informed citizens"
            ],
            "answer": "d"
          },
          {
            "id": "b9",
            "text": "If people know less about the world around them",
            "options": [
              "They may vote incorrectly",
              "They may be less involved in their community",
              "They may become biased",
              "<w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"851\" w:right=\"851\" w:bottom=\"851\" w:left=\"851\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/><w:cols w:num=\"2\" w:space=\"708\"/><w:docGrid w:linePitch=\"326\"/></w:sectPr></w:pPr><w:r w:rsidRPr=\"00851FD0\"><w:t>They may be interested in learning mor"
            ],
            "answer": "b"
          }
        ]
      }
    ]
  },

  {
    id: "fsmept-slang",
    title: "FSMEPT Listening 3 - What is up with Slang?",
    audio: "student/audio/listening-slang.mp3",
    // 114 cues, 594s, Whisper SRT; 97.5% word agreement with the human
    // transcript. Part B prints its options with no "a." prefix - same
    // block-size recovery as paper 2.
    transcript: [
    { start: 0.21, end: 2.21, text: "Chapter 9 lecture.", section: 1 },
    { start: 2.21, end: 13.01, text: "Okay, we're going to look very closely at slang today, and in particular, slang in English in the United States.", section: 1 },
    { start: 13.01, end: 27.01, text: "So, first we'll look at the meaning of slang, and then we'll look at a number of reasons why people use slang.", section: 1 },
    { start: 27.01, end: 35.01, text: "And then I want to talk a bit about how the slang is created, so how slang is made.", section: 1 },
    { start: 35.01, end: 41.01, text: "In fact, most slang in any language is created by young people.", section: 1 },
    { start: 41.01, end: 43.01, text: "So the first thing is, what is slang?", section: 1 },
    { start: 43.01, end: 50.01, text: "Okay, slang is the term for new and informal words and phrases.", section: 1 },
    { start: 50.01, end: 55.01, text: "And these words and phrases tend to come from different groups within society.", section: 1 },
    { start: 55.01, end: 58.01, text: "Let me say that again for you.", section: 1 },
    { start: 58.01, end: 67.01, text: "Slang is new and informal words or phrases which tend to come from certain groups in a society.", section: 1 },
    { start: 67.01, end: 71.01, text: "Let me move on to describe slang for you.", section: 1 },
    { start: 71.01, end: 79.01, text: "Now, in general, we use slang to say something new or to say something old in an unusual way.", section: 1 },
    { start: 79.01, end: 87.01, text: "So a quick example is, well, when people say, \"I'm pumped up,\" or \"I'm psyched,\"", section: 1 },
    { start: 87.01, end: 92.01, text: "both of these expressions someone might say to mean, \"I'm really excited.\"", section: 1 },
    { start: 92.01, end: 99.01, text: "Now, slang, as you probably know, can either be playful and funny.", section: 1 },
    { start: 99.01, end: 102.01, text: "You know, it's something you can use with friends.", section: 1 },
    { start: 102.01, end: 110.01, text: "But on the other hand, it can sometimes be impolite and offensive.", section: 1 },
    { start: 110.01, end: 113.01, text: "So it can have many different effects.", section: 1 },
    { start: 113.01, end: 118.01, text: "All right, so let's move on to why people want to use slang.", section: 1 },
    { start: 118.01, end: 120.01, text: "Well, there are a number of reasons.", section: 1 },
    { start: 120.01, end: 129.01, text: "One important reason people use slang is that slang makes people feel connected to", section: 1 },
    { start: 129.01, end: 133.01, text: "or part of a peer group.", section: 1 },
    { start: 133.01, end: 137.01, text: "So for instance, let's say there's a group of friends who spend a lot of time together.", section: 1 },
    { start: 137.01, end: 139.01, text: "Maybe they go to the same school.", section: 1 },
    { start: 139.01, end: 144.01, text: "They use more slang with each other because it makes them feel connected.", section: 1 },
    { start: 144.01, end: 146.01, text: "It's like they have their own language.", section: 1 },
    { start: 146.01, end: 154.01, text: "So in essence, when they use their slang together, they're showing their group identity,", section: 1 },
    { start: 154.01, end: 156.01, text: "like wearing the same jackets.", section: 1 },
    { start: 156.01, end: 160.01, text: "They're showing that they belong to the same group.", section: 1 },
    { start: 160.01, end: 170.01, text: "Also, and this is a key point, people use slang to show that they're friendly", section: 1 },
    { start: 170.01, end: 172.01, text: "and can be casual with each other.", section: 1 },
    { start: 172.01, end: 175.01, text: "This is especially common in the workplace.", section: 1 },
    { start: 175.01, end: 179.01, text: "Now, some people use slang to make their speech more colorful", section: 1 },
    { start: 179.01, end: 183.01, text: "or to make a certain kind of impression on other people.", section: 1 },
    { start: 183.01, end: 188.01, text: "So these are a few reasons why slang is used.", section: 1 },
    { start: 188.01, end: 193.01, text: "Now, let's move on to discuss how slang is created.", section: 1 },
    { start: 193.01, end: 200.01, text: "What I want to look at is how people create new slang expressions", section: 1 },
    { start: 200.01, end: 203.01, text: "and often change the spoken language.", section: 1 },
    { start: 203.01, end: 208.01, text: "Okay, now, slang is created in a variety of different and interesting ways.", section: 1 },
    { start: 208.01, end: 213.01, text: "One way slang is created is by taking an old word and giving it a new meaning,", section: 1 },
    { start: 213.01, end: 218.01, text: "like the slang word \"wired.\"", section: 1 },
    { start: 218.01, end: 229.01, text: "Wired.", section: 1 },
    { start: 229.01, end: 232.01, text: "So let's look at how this works.", section: 1 },
    { start: 232.01, end: 235.01, text: "You know the word \"wire,\" like the wire in an electrical cord.", section: 1 },
    { start: 235.01, end: 239.01, text: "To be \"wired\" is an adjective.", section: 1 },
    { start: 239.01, end: 243.01, text: "It means the way you feel when you've had too much coffee.", section: 1 },
    { start: 243.01, end: 247.01, text: "You feel too excited and maybe even a little crazy.", section: 1 },
    { start: 247.01, end: 249.01, text: "You feel wired.", section: 1 },
    { start: 249.01, end: 251.01, text: "You feel full of energy.", section: 1 },
    { start: 251.01, end: 257.01, text: "So that's an example of a new slang word created from an old word.", section: 1 },
    { start: 257.01, end: 263.01, text: "Okay, there's another way that slang is made, and that's by creating a new word,", section: 1 },
    { start: 263.01, end: 266.01, text: "a word that didn't exist before.", section: 1 },
    { start: 266.01, end: 271.01, text: "And the interesting thing here is that these words usually come from subcultures", section: 1 },
    { start: 271.01, end: 275.01, text: "or smaller groups from inside a culture.", section: 1 },
    { start: 275.01, end: 282.01, text: "A really good example of creating a new word is the slang word \"bling bling.\"", section: 1 },
    { start: 282.01, end: 294.01, text: "[Slang word \"bling bling\" is used to describe a person who is in a situation of anxiety and anxiety.]", section: 1 },
    { start: 294.01, end: 298.01, text: "This is a slang word that means \"shiny jewelry.\"", section: 1 },
    { start: 298.01, end: 300.01, text: "It's a noun.", section: 1 },
    { start: 300.01, end: 303.01, text: "Most people first heard \"bling bling\" in a hip-hop song some years ago,", section: 1 },
    { start: 303.01, end: 310.01, text: "and suddenly many young people began using this expression in their regular conversations.", section: 1 },
    { start: 310.01, end: 316.01, text: "So for example, someone might say, \"Look at that bling bling she's wearing.\"", section: 1 },
    { start: 316.01, end: 325.01, text: "So we've talked about creating slang by using old words in new ways, by creating new words.", section: 1 },
    { start: 325.01, end: 331.01, text: "And now let's look at a third way that slang enters the language.", section: 1 },
    { start: 331.01, end: 337.01, text: "The third way slang is made is by borrowing a word from another language,", section: 1 },
    { start: 337.01, end: 342.01, text: "or by borrowing from another culture.", section: 1 },
    { start: 342.01, end: 344.01, text: "This is what I'm interested in.", section: 1 },
    { start: 344.01, end: 351.01, text: "Slang in the United States incorporates hundreds of words from languages of the people who have come to live here,", section: 1 },
    { start: 351.01, end: 358.01, text: "like German people, Italian, Chinese, just to name a few.", section: 1 },
    { start: 358.01, end: 368.01, text: "Okay, now it's important to note that not everyone who speaks English speaks the same slang.", section: 1 },
    { start: 368.01, end: 371.01, text: "There are a few factors that create differences in slang.", section: 1 },
    { start: 371.01, end: 375.01, text: "So right now, let's take a look at a couple of these factors.", section: 1 },
    { start: 375.01, end: 383.01, text: "The first important factor is region, meaning the part of a country where a person is from.", section: 1 },
    { start: 383.01, end: 391.01, text: "So for instance, you might hear a person from the southern states say, \"Hey, y'all,\" which means, \"Hello, everybody.\"", section: 1 },
    { start: 391.01, end: 394.01, text: "But a person from California might say, \"What's up, guys?\"", section: 1 },
    { start: 394.01, end: 397.01, text: "So different regions, different slang.", section: 1 },
    { start: 397.01, end: 399.01, text: "That's the bottom line there.", section: 1 },
    { start: 399.01, end: 401.01, text: "Okay, here's another factor.", section: 1 },
    { start: 401.01, end: 403.01, text: "It's people's occupation.", section: 1 },
    { start: 403.01, end: 407.01, text: "Jobs. Jobs can have different slang, too.", section: 1 },
    { start: 407.01, end: 412.01, text: "A great deal of job-specific slang is also relevant to others.", section: 1 },
    { start: 412.01, end: 415.01, text: "So eventually it becomes popular in regular society.", section: 1 },
    { start: 415.01, end: 420.01, text: "In other words, it eventually becomes general slang.", section: 1 },
    { start: 420.01, end: 423.01, text: "Are there any questions?", section: 1 },
    { start: 423.01, end: 424.01, text: "Excellent.", section: 1 },
    { start: 424.01, end: 434.01, text: "Okay, well, so far I've only talked about slang in a positive way, but believe it or not, slang can sometimes be controversial.", section: 1 },
    { start: 434.01, end: 436.01, text: "That's right.", section: 1 },
    { start: 436.01, end: 440.01, text: "Not everyone has a positive opinion about slang.", section: 1 },
    { start: 440.01, end: 449.01, text: "For instance, some people think that if people use too much slang, eventually it might destroy the English language.", section: 1 },
    { start: 449.01, end: 451.01, text: "Let me illustrate this.", section: 1 },
    { start: 451.01, end: 457.01, text: "Remember I said that a lot of slang is created by and used by young people.", section: 1 },
    { start: 457.01, end: 464.01, text: "A lot of the slang in style today and used by young people is not grammatically correct.", section: 1 },
    { start: 464.01, end: 467.01, text: "It breaks the rules of the language.", section: 1 },
    { start: 467.01, end: 472.01, text: "Of course, young people want to break the rules of the language.", section: 1 },
    { start: 472.01, end: 481.01, text: "They want to do things differently because this shows that they are new, a new generation.", section: 1 },
    { start: 481.01, end: 484.01, text: "They don't want to follow the traditions of society.", section: 1 },
    { start: 484.01, end: 492.01, text: "A good example of youth slang that is ungrammatical is the popular expression \"my bad.\"", section: 1 },
    { start: 492.01, end: 502.01, text: "My bad.", section: 1 },
    { start: 502.01, end: 505.01, text: "My bad.", section: 1 },
    { start: 505.01, end: 509.01, text: "It's what you say when you want to show that you are responsible for a mistake.", section: 1 },
    { start: 509.01, end: 516.01, text: "Like if you forget to bring your friend his book, but it's not correct grammar.", section: 1 },
    { start: 516.01, end: 520.01, text: "We should say \"my mistake,\" but we say \"my bad.\"", section: 1 },
    { start: 520.01, end: 529.01, text: "So what I'm saying here is a lot of slang goes against the rules of the language, and some people are concerned about this.", section: 1 },
    { start: 529.01, end: 538.01, text: "Some people are also concerned when slang is used in a formal situation, like when someone is giving a speech.", section: 1 },
    { start: 538.01, end: 542.01, text: "They think that slang is too informal for a speech.", section: 1 },
    { start: 542.01, end: 545.01, text: "They're also concerned when slang is used for writing.", section: 1 },
    { start: 545.01, end: 551.01, text: "Because, as you may know, slang is used more in speaking than in writing.", section: 1 },
    { start: 551.01, end: 561.01, text: "And so, as you've probably been told by your teachers, generally slang is unacceptable in academic essays.", section: 1 },
    { start: 561.01, end: 565.01, text: "So that's a big part of the controversy about slang.", section: 1 },
    { start: 565.01, end: 570.01, text: "So to finish up, I want to make one final point.", section: 1 },
    { start: 570.01, end: 576.01, text: "When you're thinking about slang, keep in mind that languages are living things.", section: 1 },
    { start: 576.01, end: 579.01, text: "They're changing all the time.", section: 1 },
    { start: 579.01, end: 584.01, text: "A new slang helps the language grow and change.", section: 1 },
    { start: 584.01, end: 589.01, text: "All right. I'm afraid we're out of time. I'll see you next week.", section: 1 },
    { start: 589.01, end: 594.01, text: "[ Silence ]", section: 1 }
    ],
    sections: [
      {
        "title": "Part A",
        "instruction": "Mark the sentences True or False.",
        "points": "6 x 1 = 6 pts",
        "type": "truefalse",
        "questions": [
          {
            "id": "a1",
            "text": "Slang consists of new words that are being used by particular groups in society.",
            "answer": "T"
          },
          {
            "id": "a2",
            "text": "Using slang could have various impacts on people.",
            "answer": "T"
          },
          {
            "id": "a3",
            "text": "Slang helps people feel connected to their inner selves.",
            "answer": "F"
          },
          {
            "id": "a4",
            "text": "New slang expressions are only created by giving existing words a different meaning.",
            "answer": "F"
          },
          {
            "id": "a5",
            "text": "Words from foreign languages are the most common slang words.",
            "answer": "F"
          },
          {
            "id": "a6",
            "text": "There are people opposed to the use of slang.",
            "answer": "T"
          }
        ]
      },
      {
        "title": "Part B",
        "instruction": "Choose the correct option.",
        "points": "9 x 1 = 9 pts",
        "type": "mcq",
        "questions": [
          {
            "id": "b1",
            "text": "What does the lecture focus on?",
            "options": [
              "Slang in the United States versus slang elsewhere",
              "The creation, usage and meaning of US slang",
              "Why slang is so popular and who uses it",
              "Different groups in society and how they develop slang"
            ],
            "answer": "b"
          },
          {
            "id": "b2",
            "text": "Slang words and phrases are generally NOT",
            "options": [
              "New and informal",
              "Specific to certain social groups",
              "Created by younger people",
              "All of these answers are correct"
            ],
            "answer": "d"
          },
          {
            "id": "b3",
            "text": "The phrase “pumped up” is NOT synonymous with:",
            "options": [
              "Excited",
              "Psyched",
              "Nervous",
              "Eager"
            ],
            "answer": "c"
          },
          {
            "id": "b4",
            "text": "Slang makes people feel",
            "options": [
              "Excluded",
              "Connected to a peer group",
              "Individual and unique",
              "Interesting"
            ],
            "answer": "b"
          },
          {
            "id": "b5",
            "text": "One form of slang involves taking an old word and",
            "options": [
              "Giving it a different meaning",
              "Changing the way it is pronounced",
              "Changing the spelling",
              "Giving it more energy"
            ],
            "answer": "a"
          },
          {
            "id": "b6",
            "text": "Slang words that are completely new come from",
            "options": [
              "Dictionary writers",
              "Putting together two old words",
              "Subcultures",
              "Large social groups"
            ],
            "answer": "c"
          },
          {
            "id": "b7",
            "text": "The third way slang is created is through",
            "options": [
              "Hip hop songs",
              "New expressions in regular conversation",
              "German or Chinese people",
              "Borrowing words from other languages"
            ],
            "answer": "d"
          },
          {
            "id": "b8",
            "text": "English speakers may use different slang depending on",
            "options": [
              "Their region of origin and occupation",
              "Social level and workplace",
              "How much English they know and where they learned it",
              "None of these answers are correct"
            ],
            "answer": "a"
          },
          {
            "id": "b9",
            "text": "Some people have a problem with slang because",
            "options": [
              "It is not grammatically correct",
              "It is destructive",
              "It can be mistaken for other languages",
              "They do not understand what it means"
            ],
            "answer": "a"
          }
        ]
      }
    ]
  }
];

// ─── State ────────────────────────────────────────────────────────────────────
let currentExam = null;
let examSubmitted = false;
let examAudio = null;
let activeSegmentIdx = -1;

// ─── Exam lockdown ────────────────────────────────────────────────────────────
//
// The reading exam has blocked copy / cut / paste / right-click / drag and the
// Ctrl+F,P,S,U,G shortcuts since it shipped. The listening exam never did, in
// any mode, so its questions and transcript were always open to find-in-page
// and copy. This closes that gap using the same rules.
//
// It is OFF by default, exactly like reading's: free listening practice should
// stay selectable so a student can study. The caller opts in, and the placement
// test does (student/js/placement.js), because placement pulls from the real
// exam bank.
//
// Lockdown lifts on submit, so the results and transcript are readable.
let listeningLockdown = false;
let listeningLockdownWired = false;

function isListeningLockdownActive() {
  return !!(listeningLockdown && currentExam && !examSubmitted);
}

function applyListeningLockdownAttr() {
  const scr = document.getElementById('listeningExamScreen');
  if (!scr) return;
  if (isListeningLockdownActive()) scr.dataset.lockdown = '1';
  else delete scr.dataset.lockdown;
}
window.applyListeningLockdownAttr = applyListeningLockdownAttr;

// Wired ONCE on the document and gated by isListeningLockdownActive(), so an
// exam opened without the flag behaves exactly as it did before this existed.
function wireListeningLockdownListeners() {
  if (listeningLockdownWired) return;
  listeningLockdownWired = true;

  const inExam = (t) => {
    const root = document.getElementById('listeningExamScreen');
    return !!(root && t && root.contains(t));
  };
  const inField = (t) => !!(t && t.closest && t.closest('input, textarea'));

  ['copy', 'cut', 'contextmenu', 'dragstart'].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (!isListeningLockdownActive() || !inExam(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Selection is blocked outside answer fields so students can still edit
  // what they typed.
  document.addEventListener('selectstart', (e) => {
    if (!isListeningLockdownActive() || !inExam(e.target)) return;
    if (inField(e.target)) return;
    e.preventDefault();
  });

  document.addEventListener('keydown', (e) => {
    if (!isListeningLockdownActive()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const k = (e.key || '').toLowerCase();
    // Find-in-page, print, save, view-source: always blocked, so the answer
    // keywords cannot be scanned for.
    if (k === 'f' || k === 'p' || k === 's' || k === 'u' || k === 'g') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Copy / cut / paste / select-all only outside the answer fields.
    if (['c', 'x', 'v', 'a'].indexOf(k) !== -1 && !inField(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function startListeningExam(examId, opts) {
  examId = examId || 'sample-fsmept';
  currentExam = LISTENING_EXAMS.find(e => e.id === examId) || LISTENING_EXAMS[0];
  examSubmitted = false;
  activeSegmentIdx = -1;
  listeningLockdown = !!(opts && opts.lockdown);
  renderListeningExam();
  showScreen('listeningExamScreen');
  wireListeningLockdownListeners();
  applyListeningLockdownAttr();
}
// Phase F: exposed on window so the dashboard's preview-mode boot
// hook can auto-open a specific listening exam when a teacher
// previews an assignment from the teacher dashboard.
window.startListeningExam = startListeningExam;

// ─── Render ───────────────────────────────────────────────────────────────────
function renderListeningExam() {
  const exam = currentExam;
  document.getElementById('examTitle').textContent = exam.title;
  document.getElementById('examTrackTitle').textContent = exam.title.replace('Sample ', '');

  // Audio
  const audioEl = document.getElementById('examAudio');
  audioEl.src = exam.audio;
  examAudio = audioEl;
  audioEl.addEventListener('timeupdate', updateAudioProgress);
  audioEl.addEventListener('timeupdate', updateTranscriptHighlight);
  audioEl.addEventListener('loadedmetadata', () => {
    document.getElementById('examAudioDuration').textContent = formatTime(audioEl.duration);
  });
  audioEl.addEventListener('ended', () => {
    document.getElementById('examPlayBtn').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    const vinyl = document.getElementById('examVinyl');
    if (vinyl) vinyl.classList.remove('spinning');
  });

  // Sections
  const container = document.getElementById('examSectionsContainer');
  container.innerHTML = '';
  exam.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'exam-section';
    // Accordion-wrapped: the header is keyboard-clickable, and the
    // body (instruction + optional hint/note + questions div) is
    // wrapped so it can animate as a single unit. Default state =
    // expanded so first-paint behaviour is identical to the
    // pre-accordion build.
    sectionEl.innerHTML = `
      <div class="exam-section-header" role="button" tabindex="0" aria-expanded="true">
        <h3>${section.title}</h3>
        <span class="exam-section-pts">${section.points}</span>
        <span class="exam-section-chevron" aria-hidden="true">▾</span>
      </div>
      <div class="exam-section-body">
        <p class="exam-section-instruction">${section.instruction}</p>
        ${section.hint ? `<p class="exam-section-hint">${section.hint}</p>` : ''}
        ${section.note ? `<p class="exam-section-note">${section.note}</p>` : ''}
        <div class="exam-questions" id="examSection${sIdx}">
          ${section.questions.map((q, qIdx) => renderQuestion(q, qIdx, section.type)).join('')}
        </div>
      </div>
    `;
    container.appendChild(sectionEl);
  });
  // Wire accordion click + keyboard handlers for each section.
  container.querySelectorAll('.exam-section-header').forEach(head => {
    head.addEventListener('click', (e) => {
      // Don't toggle if the click started inside a focusable child
      // (preserves any future buttons / inputs in the header without
      // requiring updates here).
      if (e.target.closest('a, button, input, select, textarea')) return;
      const sec = head.closest('.exam-section');
      if (!sec) return;
      const willCollapse = !sec.classList.contains('is-collapsed');
      sec.classList.toggle('is-collapsed', willCollapse);
      head.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
    });
    head.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      head.click();
    });
  });
  // Per-question chevron handlers. Each `.exam-q-toggle` toggles
  // `.is-collapsed` on its parent `.exam-q`. Stops propagation so it
  // doesn't bubble to the section header (which sits above it).
  container.querySelectorAll('.exam-q-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = btn.closest('.exam-q');
      if (!q) return;
      const willCollapse = !q.classList.contains('is-collapsed');
      q.classList.toggle('is-collapsed', willCollapse);
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      btn.setAttribute('aria-label',
        willCollapse ? 'Expand this question' : 'Collapse this question');
      btn.setAttribute('title',
        willCollapse ? 'Click to expand this question' : 'Click to collapse this question');
    });
  });

  // Transcript - hidden initially, revealed after submit. Reset drawer state
  // so we don't carry has-transcript/drawer-open across exams.
  const transcriptArea = document.getElementById('examTranscript');
  transcriptArea.style.display = 'none';
  const splitEl = document.querySelector('.exam-split');
  if (splitEl) splitEl.classList.remove('has-transcript', 'drawer-open');
  // Also drop the mirrored class on the screen so the padding-right shift
  // doesn't persist into the next exam. Clear the mobile-view attribute too
  // so next render starts fresh (set to 'answers' again in submit).
  const screenEl = document.getElementById('listeningExamScreen');
  if (screenEl) {
    screenEl.classList.remove('drawer-open', 'has-transcript');
    screenEl.removeAttribute('data-mobile-view');
  }
  // Reset the mobile tab buttons to the default state too.
  document.querySelectorAll('.exam-mobile-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === 'answers');
  });
  if (exam.transcript && exam.transcript.length > 0) {
    const sectionLabels = { intro: 'Introduction', 1: 'Section 1 - Archaeology', 2: 'Section 2 - Ecotourism', 3: 'Section 3 - Sports' };
    let currentSection = null;
    let html = '<h3 class="transcript-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Transcript</h3>';
    html += '<div class="transcript-lines" id="transcriptLines">';
    exam.transcript.forEach((seg, i) => {
      if (seg.section !== currentSection) {
        currentSection = seg.section;
        html += `<div class="transcript-section-label">${sectionLabels[seg.section] || 'Section ' + seg.section}</div>`;
      }
      // Split segment text into word tokens so we can karaoke-highlight each one.
      // Whitespace is preserved as plain text; each real "word" gets its own span
      // with an index we can later toggle via .past-word / .active-word classes.
      const tokens = seg.text.split(/(\s+)/);
      let wIdx = 0;
      const wordsHtml = tokens.map(tok => {
        if (/^\s+$/.test(tok) || tok === '') return tok;
        const idx = wIdx++;
        return `<span class="tw" data-seg="${i}" data-wi="${idx}" onclick="event.stopPropagation(); seekToWord(${i}, ${idx})">${tok}</span>`;
      }).join('');
      html += `<div class="transcript-seg" data-idx="${i}" data-start="${seg.start}" data-end="${seg.end}" data-wc="${wIdx}" onclick="seekToSegment(${i})">
        <span class="transcript-time">${formatTime(seg.start)}</span>
        <span class="transcript-text">${wordsHtml}</span>
      </div>`;
    });
    html += '</div>';
    transcriptArea.innerHTML = html;

    // Detect manual user scroll / wheel / touch on the transcript and pause
    // auto-follow for SCROLL_GRACE_MS so the reader can review earlier lines
    // without being yanked back down to the current segment.
    const tLines = document.getElementById('transcriptLines');
    if (tLines) {
      ['wheel', 'touchstart', 'touchmove', 'keydown', 'mousedown'].forEach(evt => {
        tLines.addEventListener(evt, markUserScrolled, { passive: true });
      });
    }
  }

  // Reset UI
  document.getElementById('examSubmitBtn').style.display = '';
  document.getElementById('examSubmitBtn').disabled = false;

  // If running in calibration mode, reveal the transcript immediately
  // and attach the calibration UI. Activated via ?calibrate=1 URL param.
  if (isCalibrationMode()) initCalibrationMode();
  document.getElementById('examResultsArea').style.display = 'none';
}

function renderQuestion(q, idx, type) {
  const num = idx + 1;
  // Per-question accordion chevron - added only to truefalse + mcq
  // where the answer area is a discrete options block. Fillblank has
  // the input embedded inline in the question text, so collapsing
  // it would hide both - accordion doesn't fit there.
  const toggleBtn = `<button type="button" class="exam-q-toggle"
                            aria-expanded="true"
                            aria-label="Collapse this question"
                            title="Click to collapse this question">▾</button>`;
  if (type === 'truefalse') {
    return `<div class="exam-q" data-id="${q.id}">
      <div class="exam-q-head">
        <span class="exam-q-num">${num}.</span>
        <span class="exam-q-text">${q.text}</span>
        ${toggleBtn}
      </div>
      <div class="exam-q-body">
        <div class="exam-tf-options">
          <label class="exam-tf-label"><input type="radio" name="${q.id}" value="T"><span>T</span></label>
          <label class="exam-tf-label"><input type="radio" name="${q.id}" value="F"><span>F</span></label>
        </div>
      </div>
    </div>`;
  }
  if (type === 'mcq') {
    // This list was hardcoded to three letters. Papers with a fourth option
    // rendered it as "undefined." with value="undefined", so distractor D had no
    // label and could never be scored - picking it was always wrong. Derive the
    // letters from the options the question actually has.
    const letters = 'abcdefgh'.split('');
    return `<div class="exam-q" data-id="${q.id}">
      <div class="exam-q-head">
        <span class="exam-q-num">${num}.</span>
        <span class="exam-q-text">${q.text}</span>
        ${toggleBtn}
      </div>
      <div class="exam-q-body">
        <div class="exam-mcq-options">
          ${q.options.map((opt, i) => `
            <label class="exam-mcq-label">
              <input type="radio" name="${q.id}" value="${letters[i]}">
              <span class="exam-mcq-letter">${letters[i]}.</span>
              <span>${opt}</span>
            </label>`).join('')}
        </div>
      </div>
    </div>`;
  }
  if (type === 'fillblank') {
    // The papers do not agree on how long a blank is. The sample exam uses ten
    // underscores, the imported papers use fifteen or seventeen, so a
    // literal replace of '__________' matched NONE of them and the sentence
    // rendered with no input box at all - an unanswerable question that still
    // counted against the score. Match any run of underscores instead, and if a
    // statement carries no blank at all, append the box rather than drop it.
    const input = '<input type="text" class="exam-fill-input" name="' + q.id +
      '" autocomplete="off" spellcheck="false" placeholder="...">';
    const body = /_{3,}/.test(q.text) ? q.text.replace(/_{3,}/, input) : (q.text + ' ' + input);
    return `<div class="exam-q" data-id="${q.id}">
      <span class="exam-q-num">${num}.</span>
      <span class="exam-q-text">${body}</span>
    </div>`;
  }
  return '';
}

// ─── Audio Controls ───────────────────────────────────────────────────────────
const PLAY_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const PAUSE_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

function toggleExamAudio() {
  if (!examAudio) return;
  const btn = document.getElementById('examPlayBtn');
  const vinyl = document.getElementById('examVinyl');
  if (examAudio.paused) {
    examAudio.play();
    btn.innerHTML = PAUSE_SVG;
    if (vinyl) vinyl.classList.add('spinning');
  } else {
    examAudio.pause();
    btn.innerHTML = PLAY_SVG;
    if (vinyl) vinyl.classList.remove('spinning');
  }
}

function rewindExamAudio() {
  if (examAudio) examAudio.currentTime = Math.max(0, examAudio.currentTime - 10);
}

function forwardExamAudio() {
  if (examAudio) examAudio.currentTime = Math.min(examAudio.duration, examAudio.currentTime + 10);
}

function seekExamAudio(e) {
  if (!examAudio || !examAudio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  examAudio.currentTime = ((e.clientX - rect.left) / rect.width) * examAudio.duration;
}

function updateAudioProgress() {
  if (!examAudio || !examAudio.duration) return;
  const pct = (examAudio.currentTime / examAudio.duration) * 100;
  document.getElementById('examProgressFill').style.width = pct + '%';
  const knob = document.getElementById('examProgressKnob');
  if (knob) knob.style.left = pct + '%';
  document.getElementById('examAudioTime').textContent = formatTime(examAudio.currentTime);
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function changeExamSpeed() {
  if (!examAudio) return;
  const speeds = [0.75, 1, 1.25, 1.5];
  const cur = speeds.indexOf(examAudio.playbackRate);
  examAudio.playbackRate = speeds[(cur + 1) % speeds.length];
  document.getElementById('examSpeedBtn').textContent = examAudio.playbackRate + 'x';
}

// ─── Karaoke Transcript ──────────────────────────────────────────────────────
let activeWordIdx = -1;
// Timestamp (ms) of the user's last manual scroll inside the transcript
// container. While within SCROLL_GRACE_MS of this, auto-scroll is paused so
// the reader can freely scroll back up to review earlier lines.
let lastUserScrollAt = 0;
const SCROLL_GRACE_MS = 5000;

function markUserScrolled() { lastUserScrollAt = Date.now(); }

function userIsBrowsing() { return Date.now() - lastUserScrollAt < SCROLL_GRACE_MS; }

// Scroll the transcript container so `el` is roughly centered, but only
// move the container's own scrollTop - never the window/page scroll.
function scrollTranscriptTo(el) {
  const container = document.getElementById('transcriptLines');
  if (!container || !el) return;
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const offset = (eRect.top - cRect.top) - (container.clientHeight / 2) + (el.offsetHeight / 2);
  container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
}

function updateTranscriptHighlight() {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const t = examAudio.currentTime;
  const segs = currentExam.transcript;

  // Find the active segment by time window (if any).
  let newIdx = -1;
  for (let i = 0; i < segs.length; i++) {
    if (t >= segs[i].start && t < segs[i].end) { newIdx = i; break; }
  }

  // ── Deterministic per-word state sweep ─────────────────────────────────
  // For every segment on the page we compute, purely from `t`, what each
  // word SHOULD look like right now and apply it. No dependency on any
  // "did it change since last tick" bookkeeping - that's what used to leave
  // past-word state stuck on future segments after a backward seek (the
  // "strikethrough look" bug). This runs every ~250ms on ~30 segments with
  // ~50 words each, which classList can no-op cheaply when already correct.
  //
  // Natural English narration is ~2.8 words/sec. For sparse segments where
  // a linear word-index would crawl behind the speaker, we take the MAX of
  // linear and natural so the highlight keeps up, then let the last word
  // hold through any trailing pause.
  // Words per second for THIS recording, rather than one guess for all of them.
  //
  // This was a hardcoded 2.8. The Forger speaks at 2.54 so it looked right, but
  // News Media and Slang are both about 2.1, and since the word index is the
  // MAX of the linear and the natural position the faster guess always won: on
  // a long cue the highlight raced ahead to the last word and parked there
  // while the speaker was still mid-sentence. Slang has 33 cues over six
  // seconds and four over ten, where that overshoot is impossible to miss;
  // The Forger has none at all, which is why it never showed.
  //
  // Measured from the transcript itself so every exam, including future
  // imports, gets its own rate. Cached on the exam and clamped, so a malformed
  // transcript can neither freeze the highlight nor send it racing.
  if (currentExam._wps == null) {
    const span = segs.length ? (segs[segs.length - 1].end - segs[0].start) : 0;
    const totalWords = segs.reduce(
      (n, s) => n + String(s.text || '').split(/\s+/).filter(Boolean).length, 0);
    currentExam._wps = (span > 0 && totalWords > 0)
      ? Math.min(4, Math.max(1.5, totalWords / span))
      : 2.8;
  }
  const NATURAL_WPS = currentExam._wps;

  document.querySelectorAll('.transcript-seg').forEach(segEl => {
    const segIdx   = parseInt(segEl.dataset.idx, 10);
    const segStart = parseFloat(segEl.dataset.start);
    const segEnd   = parseFloat(segEl.dataset.end);
    const words    = segEl.querySelectorAll('.tw');
    const total    = words.length;

    if (t >= segEnd) {
      // Segment fully in the past → every word marked past.
      words.forEach(w => {
        if (!w.classList.contains('past-word')) w.classList.add('past-word');
        if (w.classList.contains('active-word')) w.classList.remove('active-word');
      });
    } else if (t < segStart || segIdx !== newIdx) {
      // Segment is in the future OR we're in a gap → every word fresh.
      words.forEach(w => {
        if (w.classList.contains('past-word'))   w.classList.remove('past-word');
        if (w.classList.contains('active-word')) w.classList.remove('active-word');
      });
    } else {
      // Segment is currently active → split into past / active / future words.
      const duration    = Math.max(0.001, segEnd - segStart);
      const elapsed     = Math.max(0, t - segStart);
      const linearWIdx  = Math.floor((elapsed / duration) * total);
      const naturalWIdx = Math.floor(elapsed * NATURAL_WPS);
      const wIdx        = Math.min(total - 1, Math.max(linearWIdx, naturalWIdx));
      words.forEach((w, idx) => {
        if (idx < wIdx) {
          if (!w.classList.contains('past-word')) w.classList.add('past-word');
          if (w.classList.contains('active-word')) w.classList.remove('active-word');
        } else if (idx === wIdx) {
          if (w.classList.contains('past-word'))    w.classList.remove('past-word');
          if (!w.classList.contains('active-word')) w.classList.add('active-word');
        } else {
          if (w.classList.contains('past-word'))   w.classList.remove('past-word');
          if (w.classList.contains('active-word')) w.classList.remove('active-word');
        }
      });
      activeWordIdx = wIdx;
    }
  });

  // ── Update which segment carries the `.active` class ──
  if (newIdx !== activeSegmentIdx) {
    const oldActive = document.querySelector('.transcript-seg.active');
    if (oldActive) oldActive.classList.remove('active');

    if (newIdx >= 0) {
      const el = document.querySelector(`.transcript-seg[data-idx="${newIdx}"]`);
      if (el) {
        el.classList.add('active');
        if (!userIsBrowsing()) scrollTranscriptTo(el);
      }
    }
    activeSegmentIdx = newIdx;
    activeWordIdx = -1;
  }
}

function seekToSegment(idx) {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const seg = currentExam.transcript[idx];
  if (seg) {
    examAudio.currentTime = seg.start;
    if (examAudio.paused) toggleExamAudio();
  }
}

// ─── Transcript drawer toggle ────────────────────────────────────────────────
// Called by the floating "Transcript" tab and the in-drawer close button.
// Passing no argument flips the state; passing a boolean forces it.
function toggleTranscriptDrawer(force) {
  const split = document.querySelector('.exam-split');
  const screen = document.getElementById('listeningExamScreen');
  if (!split) return;
  const shouldOpen = typeof force === 'boolean' ? force : !split.classList.contains('drawer-open');
  split.classList.toggle('drawer-open', shouldOpen);
  // Mirror onto the screen so the CSS padding-right rule shifts the audio
  // player and header, not just the questions column.
  if (screen) screen.classList.toggle('drawer-open', shouldOpen);

  // When opening, snap the scroll position to the currently-active segment
  // if we have one (so they land on what's playing), otherwise to the top.
  // Without this, after a full audio playthrough the drawer would open
  // scrolled to the very bottom.
  if (shouldOpen) {
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (!lines) return;
      const activeSeg = lines.querySelector('.transcript-seg.active');
      if (activeSeg) {
        scrollTranscriptTo(activeSeg);
      } else {
        lines.scrollTop = 0;
      }
    });
  }
}

// ─── Mobile view switcher ───────────────────────────────────────────────────
// On narrow screens the transcript is NOT a slide-in drawer - it's a tabbed
// sibling of the questions area. Tapping a tab flips a data attribute on
// #listeningExamScreen that CSS uses to show/hide the two panes. On desktop
// this function is effectively a no-op: both panes are visible via the
// side drawer, and the mobile tab bar is display:none.
function switchExamMobileView(view) {
  if (view !== 'answers' && view !== 'transcript') return;
  const screen = document.getElementById('listeningExamScreen');
  if (!screen) return;
  screen.setAttribute('data-mobile-view', view);
  document.querySelectorAll('.exam-mobile-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  // When switching TO the transcript, land on the active segment if there is
  // one; otherwise start at the top. Without this the user would land wherever
  // the transcript happened to be scrolled.
  if (view === 'transcript') {
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (!lines) return;
      const activeSeg = lines.querySelector('.transcript-seg.active');
      if (activeSeg) scrollTranscriptTo(activeSeg);
      else lines.scrollTop = 0;
    });
  }
  // Scroll the page itself back to top so the user sees the tab bar (and
  // whatever content it reveals) from the start, not mid-scroll.
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(_){}
}

// Jump directly to an individual word's estimated timestamp (linear within
// the segment). Useful when the student wants to replay a specific phrase.
function seekToWord(segIdx, wordIdx) {
  if (!examAudio || !currentExam || !currentExam.transcript) return;
  const seg = currentExam.transcript[segIdx];
  if (!seg) return;
  const segEl = document.querySelector(`.transcript-seg[data-idx="${segIdx}"]`);
  const total = segEl ? segEl.querySelectorAll('.tw').length : 1;
  const duration = seg.end - seg.start;
  const offset = total > 0 ? (wordIdx / total) * duration : 0;
  examAudio.currentTime = seg.start + offset;
  if (examAudio.paused) toggleExamAudio();
}

// ─── Submit & Score ──────────────────────────────────────────────────────────

// An answer key may offer alternatives, written with a spaced slash the way the
// the source keys do: "up to date / current". Both are correct and a student types
// one of them, so comparing against the whole string marked every right answer
// wrong. Accept any variant, and compare on collapsed whitespace so a stray
// double space is not a failure.
//
// The slash must have spaces around it. Splitting on a bare "/" would wreck a
// legitimate answer like "24/7". Keys with no spaced slash behave exactly as
// before, which is every answer the app shipped with.
function acceptsFill(given, answer) {
  if (answer == null) return false;
  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  const g = norm(given);
  if (!g) return false;
  return String(answer).split(/\s+\/\s+/).map(norm).filter(Boolean).some((v) => v === g);
}

function submitListeningExam() {
  if (examSubmitted) return;
  examSubmitted = true;
  // Lift lockdown now the answers are in, so the results and the transcript
  // can be read, selected and copied for review. Mirrors the reading exam,
  // whose isLockdownActive() also goes false once state.submitted is set.
  applyListeningLockdownAttr();

  // Stop audio
  if (examAudio && !examAudio.paused) {
    examAudio.pause();
    document.getElementById('examPlayBtn').innerHTML = PLAY_SVG;
    const vinyl = document.getElementById('examVinyl');
    if (vinyl) vinyl.classList.remove('spinning');
  }

  const exam = currentExam;
  let totalCorrect = 0;
  let totalQuestions = 0;
  const liItems = [];   // per-question detail for the teacher drill-down (QA #4)

  exam.sections.forEach((section) => {
    section.questions.forEach((q) => {
      totalQuestions++;
      let userAnswer = '';
      if (section.type === 'truefalse' || section.type === 'mcq') {
        const checked = document.querySelector(`input[name="${q.id}"]:checked`);
        userAnswer = checked ? checked.value : '';
      } else if (section.type === 'fillblank') {
        const input = document.querySelector(`input[name="${q.id}"]`);
        userAnswer = input ? input.value.trim().toLowerCase() : '';
      }

      const correct = section.type === 'fillblank'
        ? acceptsFill(userAnswer, q.answer)
        : userAnswer === q.answer;

      if (correct) totalCorrect++;
      liItems.push({
        q: (q.text || q.prompt || q.question || q.q || q.id || ''),
        a: userAnswer,
        correct: (q.answer == null ? '' : String(q.answer)),
        ok: !!correct
      });

      const qEl = document.querySelector(`.exam-q[data-id="${q.id}"]`);
      if (qEl) {
        qEl.classList.add(correct ? 'exam-q-correct' : 'exam-q-incorrect');
        if (!correct) {
          const fb = document.createElement('div');
          fb.className = 'exam-q-feedback';
          fb.textContent = 'Correct: ' + q.answer;
          qEl.appendChild(fb);
        }
      }
    });
  });

  // Disable inputs
  document.querySelectorAll('#examSectionsContainer input').forEach(i => i.disabled = true);

  // Show results
  const pct = Math.round((totalCorrect / totalQuestions) * 100);
  // Optional host-page hook (placement.html): hand over the score without
  // touching the normal results flow. Fail-silent by design.
  try {
    if (typeof window.onListeningExamSubmitted === 'function') {
      window.onListeningExamSubmitted({ correct: totalCorrect, total: totalQuestions, pct: pct, examId: exam && exam.id });
    }
  } catch (_) {}
  const resultsArea = document.getElementById('examResultsArea');
  resultsArea.style.display = 'block';
  resultsArea.innerHTML = `
    <div class="exam-results-card ${pct >= 70 ? 'exam-pass' : 'exam-fail'}">
      <div class="exam-results-score">${totalCorrect}/${totalQuestions}</div>
      <div class="exam-results-pct">${pct}%</div>
      <div class="exam-results-label">${pct >= 70 ? '🎉 Well Done!' : '📖 Keep Practicing!'}</div>
    </div>`;

  document.getElementById('examSubmitBtn').style.display = 'none';

  // Reveal the transcript drawer. `has-transcript` unlocks the toggle tab
  // (it appears on the right edge); `drawer-open` slides the panel into view.
  // IMPORTANT: clear the inline `display` we set in render() - do NOT set
  // display:block here. #examTranscript's CSS rule is `display: flex` with
  // `flex-direction: column`, which is what gives .transcript-lines a bounded
  // height so its `overflow-y: auto` actually scrolls. Setting display:block
  // inline would override the flex, collapse the height chain, and make the
  // whole transcript render full-length with no internal scroll.
  const transcriptArea = document.getElementById('examTranscript');
  if (transcriptArea) {
    transcriptArea.style.display = '';
    const split = document.querySelector('.exam-split');
    const screen = document.getElementById('listeningExamScreen');
    if (split) {
      split.classList.add('has-transcript');
      split.classList.add('drawer-open');
    }
    // Mirror the class onto the screen itself so the CSS padding-right rule
    // shifts the audio player + header, not just the questions area. We also
    // mirror `has-transcript` so the mobile tab bar (which sits outside the
    // .exam-split subtree) can key off it without needing CSS :has().
    if (screen) {
      screen.classList.add('drawer-open');
      screen.classList.add('has-transcript');
      // Default mobile view = 'answers'. CSS on mobile uses this attribute
      // to choose which pane is visible; the user taps the "Transcript" tab
      // to switch. This has no effect on desktop (tab bar is display:none).
      if (!screen.hasAttribute('data-mobile-view')) {
        screen.setAttribute('data-mobile-view', 'answers');
      }
    }

    // Start at the top of the transcript so the student reviews from the
    // beginning, not wherever the playhead happened to stop (which after a
    // full listen was the very bottom - "all the way down").
    requestAnimationFrame(() => {
      const lines = document.getElementById('transcriptLines');
      if (lines) lines.scrollTop = 0;
    });
  }

  // ── Track to Firebase ──
  logListeningExamSession(totalCorrect, totalQuestions, pct, liItems);

  resultsArea.scrollIntoView({ behavior: 'smooth' });
}

// ─── Firebase Session Logging ────────────────────────────────────────────────
async function logListeningExamSession(correct, total, pct, items) {
  // Phase F: preview mode - teacher is just inspecting the exam,
  // don't pollute their session history or trigger XP / activity logs.
  if (window.__previewMode) {
    console.log('[preview] skipping listening session write');
    return;
  }
  if (typeof auth === 'undefined' || !auth.currentUser) return;
  try {
    // Denormalize student class / level / module - see Phase B in DEPLOY.md.
    const scope = (typeof studentScopeFields === 'function') ? studentScopeFields() : { studentClass:'', studentLevel:'', studentModule:'' };
    // Running total for the dashboard average; see student/js/score-rollup.js.
    if (window.LLRollup) LLRollup.record(db, user.uid, pct);
    await db.collection('sessions').add({
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || auth.currentUser.email || 'Student',
      book: typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
      activity: 'listening-exam',
      // Record the REAL exam id (was hardcoded 'fsmept'/'exam'). The
      // assignment-completion matcher pairs session.unit with
      // assignment.examId, so this must be the actual exam id -
      // otherwise listening assignments never auto-complete and any
      // future second listening exam would be indistinguishable.
      level: (currentExam && currentExam.level) || 'exam',
      unit:  (currentExam && currentExam.id)    || 'fsmept',
      examTitle: (currentExam && currentExam.title) || '',
      score: correct,
      total: total,
      percentage: pct,
      correctAnswers: correct,
      totalQuestions: total,
      wordsLearned: [],
      answers: { skill: 'listening', items: items || [] },   // per-question detail (QA #4)
      ...scope,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // XP reward
    if (typeof addXP === 'function') addXP(Math.round(pct / 10));

    // Refresh journey stats
    if (typeof loadJourneyStats === 'function') await loadJourneyStats();

    // Log activity
    if (typeof ActivityLogger !== 'undefined') {
      await ActivityLogger.logPracticeCompleted({
        book: typeof selectedBook !== 'undefined' ? selectedBook : 'empower',
        level: 'exam', unit: 'fsmept',
        activity: 'listening-exam', score: pct, wordsCount: total
      });
    }
  } catch (e) { console.error('Failed to log listening exam:', e); }
}

// Leaving mid-exam loses the attempt, so ask first - the same guard the
// reading exam has. Without it a stray tap (or the phone's back gesture,
// which lands here too) silently threw the attempt away.
function backFromExam() {
  if (!examSubmitted && currentExam) {
    if (window.AppDialog && typeof AppDialog.confirm === 'function') {
      AppDialog.confirm('Your answers in this attempt will be lost.',
        { title: 'Leave this exam?', okLabel: 'Leave', cancelLabel: 'Stay', danger: true })
        .then(function (ok) { if (ok) doLeaveExam(); });
      return;
    }
    if (!window.confirm('Leave this exam? Your answers in this attempt will be lost.')) return;
  }
  doLeaveExam();
}

// Register the exam as a screen the system back gesture cannot silently leave.
// Returning false tells back-nav.js to cancel the navigation; we then show the
// same confirm the Exit button uses, so both routes out behave identically.
window.screenExitGuards = window.screenExitGuards || {};
window.screenExitGuards.listeningExamScreen = function () {
  if (examSubmitted || !currentExam) return true;
  backFromExam();
  return false;
};


// Timed exams call requestFullscreen() on entry (skills/reading.js). Nothing
// released it, so the browser stayed full-page after the exam closed and the
// rest of the app was left in an exam-shaped window. Every exit path calls this.
function leaveExamFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen ||
               document.mozCancelFullScreen || document.msExitFullscreen;
      if (ex) ex.call(document);
    }
  } catch (_) {}
}

function doLeaveExam() {
  leaveExamFullscreen();
  if (examAudio) { examAudio.pause(); examAudio.currentTime = 0; }
  document.getElementById('examPlayBtn').innerHTML = PLAY_SVG;
  const vinyl = document.getElementById('examVinyl');
  if (vinyl) vinyl.classList.remove('spinning');
  // Back to the listening SECTION, not all the way out to the dashboard. Leaving an
  // exam should put you where you started it, so the next exam is one tap away.
  // backToHub() used to call renderHub() on the way out, which is what kept the
  // skill rings current. We are not going to the hub any more, so refresh it
  // directly - the ring must be right when the student does reach the hub.
  showScreen('listeningScreen');
  if (typeof window.renderHub === 'function') {
    try { window.renderHub(); } catch (_) {}
  }
}

// ─── Transcript Calibration Tool ─────────────────────────────────────────────
// Hidden admin tool for aligning EXAM_TRANSCRIPT timestamps against the actual
// audio. Activate with ?calibrate=1 on the URL. Press SPACE when you hear each
// segment begin, Z to undo, E to export the updated transcript array.
// ─────────────────────────────────────────────────────────────────────────────
let calibrationCaptures = [];   // array of {segIdx, capturedAt}
let calibrationNextIdx = 0;     // index of the next segment to capture

function isCalibrationMode() {
  try { return new URLSearchParams(window.location.search).has('calibrate'); }
  catch (e) { return false; }
}

function initCalibrationMode() {
  if (!currentExam || !currentExam.transcript) return;

  calibrationCaptures = [];
  calibrationNextIdx = 0;

  // Reveal the transcript drawer (open by default in calibration mode - the
  // operator needs it visible to do their job). Clear the inline display so
  // the CSS flex rule wins - see note in submitListeningExam.
  const transcriptArea = document.getElementById('examTranscript');
  if (transcriptArea) {
    transcriptArea.style.display = '';
    const split = document.querySelector('.exam-split');
    if (split) split.classList.add('has-transcript', 'drawer-open');
    const screen = document.getElementById('listeningExamScreen');
    if (screen) {
      screen.classList.add('drawer-open', 'has-transcript');
      // In calibration mode the operator needs to SEE the transcript, so on
      // mobile default the view to 'transcript' (not 'answers').
      screen.setAttribute('data-mobile-view', 'transcript');
    }
  }

  // Remove any existing panel so re-render doesn't duplicate it
  const existing = document.getElementById('calibrationPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'calibrationPanel';
  panel.className = 'calibration-panel';
  panel.innerHTML = `
    <div class="cal-header">
      <span class="cal-badge">🎯 CALIBRATION MODE</span>
      <span class="cal-progress" id="calProgress">0 / ${currentExam.transcript.length}</span>
    </div>
    <div class="cal-current">
      <div class="cal-label">Listen for segment <span id="calSegNum">1</span>:</div>
      <div class="cal-text" id="calText"></div>
    </div>
    <div class="cal-time-row">
      <span class="cal-label">Current time:</span>
      <span class="cal-time" id="calTime">0:00.0</span>
    </div>
    <div class="cal-actions">
      <button onclick="calibrationCapture()" class="cal-btn cal-btn-primary" title="Space">
        <kbd>Space</kbd> Mark Start
      </button>
      <button onclick="calibrationUndo()" class="cal-btn" title="Z">
        <kbd>Z</kbd> Undo
      </button>
      <button onclick="calibrationExport()" class="cal-btn cal-btn-export" title="E">
        <kbd>E</kbd> Export
      </button>
    </div>
    <div class="cal-hint">
      Press <kbd>Space</kbd> the instant the speaker begins the highlighted segment.
      Use the player's ⏪ / ⏩ buttons to rewind and try again if you miss it.
      Already-captured segments show ✓ in the transcript below.
    </div>
    <textarea id="calOutput" class="cal-output" style="display:none;" readonly placeholder="Export output will appear here…"></textarea>
  `;
  document.body.appendChild(panel);

  // Stream the live audio time into the panel
  if (examAudio) examAudio.addEventListener('timeupdate', updateCalibrationTime);

  updateCalibrationUI();

  // Keyboard shortcuts (registered once; safe to call repeatedly because we
  // remove the previous listener before adding a new one)
  document.removeEventListener('keydown', calibrationKeyHandler);
  document.addEventListener('keydown', calibrationKeyHandler);
}

function calibrationKeyHandler(e) {
  if (!isCalibrationMode()) return;
  // Don't steal keys while the operator is typing in a field
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') { e.preventDefault(); calibrationCapture(); }
  else if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); calibrationUndo(); }
  else if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); calibrationExport(); }
}

function calibrationCapture() {
  if (!examAudio || !currentExam) return;
  if (calibrationNextIdx >= currentExam.transcript.length) return;

  const t = examAudio.currentTime;
  calibrationCaptures.push({ segIdx: calibrationNextIdx, capturedAt: t });
  calibrationNextIdx++;
  updateCalibrationUI();

  // Brief flash for tactile feedback
  const panel = document.getElementById('calibrationPanel');
  if (panel) {
    panel.classList.add('cal-flash');
    setTimeout(() => panel.classList.remove('cal-flash'), 180);
  }
}

function calibrationUndo() {
  if (calibrationCaptures.length === 0) return;
  calibrationCaptures.pop();
  calibrationNextIdx = Math.max(0, calibrationNextIdx - 1);
  updateCalibrationUI();
}

function updateCalibrationTime() {
  const el = document.getElementById('calTime');
  if (el && examAudio) {
    const t = examAudio.currentTime;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    el.textContent = `${m}:${s}`;
  }
}

function updateCalibrationUI() {
  const progress = document.getElementById('calProgress');
  const segNum = document.getElementById('calSegNum');
  const text = document.getElementById('calText');
  if (!currentExam) return;
  const total = currentExam.transcript.length;

  if (progress) progress.textContent = `${calibrationNextIdx} / ${total}`;

  // Clear any previous target highlight
  document.querySelectorAll('.transcript-seg.cal-target').forEach(el =>
    el.classList.remove('cal-target'));

  // Mark the already-captured segments as done
  document.querySelectorAll('.transcript-seg.cal-done').forEach(el =>
    el.classList.remove('cal-done'));
  calibrationCaptures.forEach(c => {
    const el = document.querySelector(`.transcript-seg[data-idx="${c.segIdx}"]`);
    if (el) el.classList.add('cal-done');
  });

  if (calibrationNextIdx >= total) {
    if (segNum) segNum.textContent = '✓';
    if (text) text.textContent = 'All segments captured. Press E to export.';
    return;
  }

  const seg = currentExam.transcript[calibrationNextIdx];
  if (segNum) segNum.textContent = calibrationNextIdx + 1;
  if (text) text.textContent = seg.text;

  const targetEl = document.querySelector(`.transcript-seg[data-idx="${calibrationNextIdx}"]`);
  if (targetEl) {
    targetEl.classList.add('cal-target');
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function calibrationExport() {
  if (!currentExam) return;
  const orig = currentExam.transcript;
  const captures = new Map(calibrationCaptures.map(c => [c.segIdx, c.capturedAt]));

  // Each segment's start = captured time; end = next segment's captured start
  // (or original end if no next capture exists).
  const round = v => Math.round(v * 10) / 10;
  const updated = orig.map((seg, i) => {
    const newStart = captures.has(i) ? captures.get(i) : seg.start;
    const nextStart = captures.has(i + 1)
      ? captures.get(i + 1)
      : (orig[i + 1] ? orig[i + 1].start : seg.end);
    return {
      start: round(newStart),
      end: round(nextStart),
      text: seg.text,
      section: seg.section
    };
  });

  // Format as pretty JS array literal (unquoted keys, aligned columns)
  const lines = updated.map(s => {
    const start = String(s.start).padStart(6, ' ');
    const end = String(s.end).padStart(6, ' ');
    const sectionVal = typeof s.section === 'string' ? `'${s.section}'` : s.section;
    const textEscaped = s.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `  { start: ${start}, end: ${end}, text: '${textEscaped}', section: ${sectionVal} },`;
  });
  const js = 'const EXAM_TRANSCRIPT = [\n' + lines.join('\n') + '\n];';

  const output = document.getElementById('calOutput');
  if (output) {
    output.value = js;
    output.style.display = 'block';
    output.focus();
    output.select();
    // Best-effort clipboard copy
    try {
      navigator.clipboard.writeText(js).then(() => {
        if (typeof showToast === 'function') showToast('Transcript copied to clipboard');
      });
    } catch (e) { /* fall through to manual select */ }
  }
  console.log('[calibration] Exported transcript:\n' + js);
}
