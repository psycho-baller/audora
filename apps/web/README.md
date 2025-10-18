# Audora

## Inspiration

We’ve always believed that the strongest force in the world isn’t data, code, or money, it’s the connections we make with each other. As human beings, we’re wired to link, to bond, to feel seen. But the modern world makes that hard. We’re flooded with noise, trapped in surface-level talk, and robbed of real presence. Audora was born out of a simple but urgent question: *How can we help people truly connect? and why do current platforms not solve that problem?*

We saw the root of the problem in communication: it's not just what we say, but how we say it. From filler words to unfocused rambles, most of us don’t realize how much we get in our own way. So we set out to build a tool that gives people the power to understand and improve how they speak, with the ultimate goal to unlock deeper relationships through better conversations.

---

## What it does

Audora is an on-device speech reflection app that helps you become a more intentional, articulate, and connected communicator. It listens as you speak, with your full consent, and delivers personalized feedback on:

* Filler word usage
* Pacing and pauses
* Redundancy and repeated words
* Weak phrasing and vague language
* Sentence starters and structure
* Conciseness vs rambling
* Context-aware rewording suggestions

But more than that, it helps you *see* how your words affect your relationships. Are you clear? Do you sound engaged? Are you deepening connection, or just filling silence?

It’s like a mirror for how you talk — so you can maxx out how you link.

---

## How we built it

We built Audora with one guiding principle: everything should work **on-device**. That meant starting with Whisper-tiny for local transcription, pairing it with timestamp-aware NLP pipelines, and layering custom rule-based analysis and algorithms (filler detection, pacing, repetition) on top.

The transcription happens in realtime. So as you speak, the device analyses the conversation

For smarter insights, like better phrasing or compression, we used OpenAI’s GPT-5 with user-controlled opt-in. That gave us a hybrid architecture: fast, privacy-first feedback on-device, and deeper coaching from the cloud only when needed.

We designed a mobile-first UX that focuses on clarity: clear flags, clean summaries, and a coaching tone that builds confidence.

For every conversation you have, you can go on a phone call or chat with an AI to reflect on how it went:

* hat you learned about yourself
* about them
* what you can talk about for next time
* Key things to keep in mind next time you chat with them

---

## Challenges we ran into

* **False positives in feedback:** Not every "just" or "like" is a problem. Context is king, so we had to tune aggressively.
* Graph database not accurately connecting people
* **Conciseness scoring**: It’s surprisingly hard to know when someone is being "too wordy" without just asking a model to summarize it.
* **Balancing critique with encouragement**: Feedback that feels robotic or overly critical makes users bounce. Tone matters.
* **Latency vs insight**: LLMs are slow. We had to make sure most of the experience felt instant, and reserved LLM calls for high-value moments
* Connected different cutting-edge technologies and made them work together

---

## Accomplishments that we're proud of

* We created a working speech reflection engine that leverages the latest and greatest AI tech while being mindful of people's privacy
* We built a system that grows with people
* We turned vague concepts like “speaking clearly” or “being concise” into real-time, trackable metrics.
* We created a system that respects privacy. Like a therapist that would never share personal info to anyone else

---

## What we learned

* transcribe conversations between people with diarization IN REALTIME!
* People crave deeper relationships more than performance metrics — but they’ll use metrics if it gets them there.
* Small, well-timed insights are more powerful than long reports.
* Nobody wants to be judged — they want to feel seen and supported.
* On-device AI is hard, but it's the future if you care about trust.
* Self-awareness is rare. Tools that help us listen to ourselves can change how we listen to others.

---

## What's next for Audora

We're just getting started.

Next, we’re:

* Expanding our emotional tone detection layer — to help users see how their tone aligns with their intention
* Have CRM features to remember key info from conversations
* Building a “conversation challenge” system, lightweight prompts to help people practice linking better
* Creating a private memory system that tracks your growth, not just per session, but across time
* Exploring integrations with IRL communities (student clubs, events, teams) to help people reflect *together*, not just alone
* Maybe designing a wearable mode for ambient conversation reflection (without screens)

We believe Audora can become a core part of how people grow, not just as communicators, but as humans who want to connect more deeply.

Built with ❤️ using React Router v7, Convex, Clerk, Polar.sh, ZepCloud, Speechmatics, Vapi, GraphDB, VectorDB, and OpenAI

## Competition

There are dozens of platforms that promise communication transformation like getfluently.app (a YC-backed company), but there are several problems that are left unsolved for several audiences:

* People don’t have the time to sit and talk to an AI
* Most platforms are focused on non-native English speakers. But there’s an untapped market for:

  * busy professionals:

    * who need to become master communnicators to excel at their job
    * who talk to A LOT of people everyday and would benefit from improving their communication skills
  * people who love socializing and want to make the best of each interaction they have with someone

* A lot of these platforms are money hungry and get a lot of negative reviews saying they kept on getting billed despite cancelling their plan. They don’t allow free trials or their free version is very limited -> we can be open-source

Many virtual meeting bots exist which help storing and remember everything that was shared during these meetings, but physical meetups are served only by expensive AI wearables that raise significant privacy concerns. We believe we can bring forth a privacy-first approach for remembering all your in-person interactions with 3 key features enhancing it:

1. **Memory Vault that grows with you:** A secure, evolving vault that stores summaries, key facts, reflections, and relational cues from your conversations. As you engage with more people, it reveals how your relationships connect and evolve, helping you understand, manage, and strengthen them over time.
2. **Contextual Reflection:** Lets users revisit past conversations and dig deeper: analyzing specific moments, identifying speech patterns to improve, and exploring what topics or insights could spark stronger future conversations.
3. **Adaptive Learning:** Evolves into a personalized communication coach that grows with you — tracking your speaking patterns, learning your strengths and blind spots, and refining its feedback to guide you toward more confident, intentional, and impactful conversations
