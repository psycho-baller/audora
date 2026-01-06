// ============================================
// BROWSER DIAGNOSTICS - Yoodli Features
// ============================================
// Copy and paste this into your browser console (F12)
// when viewing a conversation page

console.log("🔍 Starting Yoodli Features Diagnostics...\n");

// Test 1: Check if we're on the right page
console.log("1️⃣ Page Check:");
const currentPath = window.location.pathname;
const isConversationPage = currentPath.includes("/dashboard/view/");
console.log(`   Current URL: ${window.location.href}`);
console.log(`   Is Conversation Page: ${isConversationPage ? "✅" : "❌"}`);
if (!isConversationPage) {
  console.log("   ⚠️ Please navigate to a conversation page (/dashboard/view/:id)");
}
console.log("");

// Test 2: Check audio element
console.log("2️⃣ Audio Player:");
const audioElement = document.querySelector("audio");
if (audioElement) {
  console.log("   Audio element: ✅ Found");
  console.log(`   Audio src: ${audioElement.src}`);
  console.log(`   Duration: ${audioElement.duration || "Not loaded yet"} seconds`);
  console.log(`   Current time: ${audioElement.currentTime} seconds`);
} else {
  console.log("   Audio element: ❌ Not found");
}
console.log("");

// Test 3: Check for timeline markers
console.log("3️⃣ Timeline Markers:");
const markers = document.querySelectorAll('[class*="absolute"][class*="w-1"][class*="h-"]');
const fillerMarkers = document.querySelectorAll('[class*="bg-yellow-500"]');
const weakMarkers = document.querySelectorAll('[class*="bg-orange-500"]');
const starterMarkers = document.querySelectorAll('[class*="bg-blue-500"]');
console.log(`   Total markers: ${markers.length}`);
console.log(`   Filler word markers (yellow): ${fillerMarkers.length}`);
console.log(`   Weak word markers (orange): ${weakMarkers.length}`);
console.log(`   Starter markers (blue): ${starterMarkers.length}`);
if (markers.length === 0) {
  console.log("   ⚠️ No markers found - analytics may not be generated yet");
}
console.log("");

// Test 4: Check transcript words
console.log("4️⃣ Transcript Words:");
const transcriptWords = document.querySelectorAll('[class*="cursor-pointer"][class*="rounded"]');
console.log(`   Total clickable words: ${transcriptWords.length}`);
const highlightedWords = document.querySelectorAll('[class*="bg-yellow-500"], [class*="bg-orange-500"], [class*="bg-blue-500"]');
console.log(`   Highlighted words (filler/weak/starter): ${highlightedWords.length}`);
if (transcriptWords.length === 0) {
  console.log("   ⚠️ No transcript words found - transcript may not be loaded");
}
console.log("");

// Test 5: Check waveform
console.log("5️⃣ Waveform:");
const waveformCanvas = document.querySelector("canvas");
const waveformToggle = document.querySelector('[aria-label="Toggle waveform"]');
console.log(`   Waveform canvas: ${waveformCanvas ? "✅ Found" : "❌ Not found"}`);
console.log(`   Waveform toggle: ${waveformToggle ? "✅ Found" : "❌ Not found"}`);
if (waveformToggle) {
  const isActive = waveformToggle.querySelector('.text-primary');
  console.log(`   Waveform active: ${isActive ? "Yes" : "No"}`);
}
console.log("");

// Test 6: Check analytics panel
console.log("6️⃣ Analytics Panel:");
const analyticsTabs = document.querySelectorAll('[role="tab"]');
console.log(`   Analytics tabs found: ${analyticsTabs.length}`);
if (analyticsTabs.length > 0) {
  Array.from(analyticsTabs).forEach((tab, i) => {
    console.log(`   Tab ${i + 1}: ${tab.textContent}`);
  });
} else {
  console.log("   ⚠️ No analytics tabs found");
}
console.log("");

// Test 7: Check AI feedback section
console.log("7️⃣ AI Personalized Feedback:");
const feedbackSection = document.querySelector('[class*="bg-gradient-to-br"][class*="from-primary"]');
const generateButton = Array.from(document.querySelectorAll('button')).find(
  btn => btn.textContent?.includes('Generate AI Feedback')
);
console.log(`   Feedback section: ${feedbackSection ? "✅ Found" : "❌ Not found"}`);
console.log(`   Generate button: ${generateButton ? "✅ Found" : "❌ Not found"}`);
console.log("");

// Test 8: Check export dialog
console.log("8️⃣ Export & Share:");
const exportButton = Array.from(document.querySelectorAll('button')).find(
  btn => btn.textContent?.includes('Share') && btn.textContent?.includes('Export')
);
console.log(`   Export button: ${exportButton ? "✅ Found" : "❌ Not found"}`);
console.log("");

// Test 9: Check speaker avatars
console.log("9️⃣ Speaker Identification:");
const avatars = document.querySelectorAll('[class*="rounded-full"][class*="gradient"]');
const youBadges = Array.from(document.querySelectorAll('span')).filter(
  span => span.textContent === 'You'
);
console.log(`   Speaker avatars: ${avatars.length}`);
console.log(`   "You" badges: ${youBadges.length}`);
console.log("");

// Summary
console.log("📊 Summary:");
const checks = {
  "On conversation page": isConversationPage,
  "Audio player present": !!audioElement,
  "Timeline markers": markers.length > 0,
  "Transcript words": transcriptWords.length > 0,
  "Waveform available": !!waveformToggle,
  "Analytics tabs": analyticsTabs.length >= 3,
  "AI feedback section": !!feedbackSection,
  "Export button": !!exportButton,
  "Speaker avatars": avatars.length > 0
};

const passedChecks = Object.values(checks).filter(v => v).length;
const totalChecks = Object.keys(checks).length;

console.log(`   Passed: ${passedChecks}/${totalChecks} checks`);
Object.entries(checks).forEach(([check, passed]) => {
  console.log(`   ${passed ? "✅" : "❌"} ${check}`);
});

console.log("\n✨ Diagnostics complete!");
console.log("\n💡 Next steps:");
if (passedChecks === totalChecks) {
  console.log("   🎉 All checks passed! Try these manual tests:");
  console.log("   1. Click play button and watch words highlight");
  console.log("   2. Click any word in transcript to seek");
  console.log("   3. Toggle waveform view");
  console.log("   4. Generate AI feedback");
  console.log("   5. Try export options");
} else {
  console.log("   ⚠️ Some checks failed. Common fixes:");
  if (!isConversationPage) {
    console.log("   - Navigate to /dashboard/view/:id");
  }
  if (!audioElement) {
    console.log("   - Check if conversation has audio uploaded");
  }
  if (markers.length === 0) {
    console.log("   - Wait for analytics to auto-generate");
    console.log("   - Check analytics panel and refresh page");
  }
  if (transcriptWords.length === 0) {
    console.log("   - Check if conversation has transcript with word timing");
  }
}

console.log("\n📖 See TESTING_CHECKLIST.md for detailed testing guide");


