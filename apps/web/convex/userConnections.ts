import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Extract keywords from facts (strict - only meaningful topics)
function extractKeywords(facts: string[]): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "am", "are", "was", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "must", "can", "i", "you", "he", "she", "it",
    "we", "they", "my", "your", "his", "her", "its", "our", "their", "me",
    "him", "them", "this", "that", "these", "those", "who", "what", "when",
    "where", "why", "how", "just", "like", "really", "very", "also", "some",
    "about", "into", "than", "such", "other", "only", "more", "much", "many",
    "most", "said", "says", "know", "make", "made", "being", "going", "get",
    "got", "want", "wants", "wanted", "need", "needs", "needed", "thing",
    "things", "time", "times", "year", "years", "day", "days", "way", "ways",
    "been", "doing", "done", "goes", "went", "come", "came", "take", "took",
    "give", "gave", "tell", "told", "work", "works", "worked", "look", "looks",
    "looked", "feel", "feels", "felt", "find", "found", "give", "gave", "keep",
    "keeps", "kept", "call", "calls", "called", "try", "tries", "tried", "ask",
    "asked", "turn", "turned", "put", "puts", "mean", "means", "meant", "leave",
    "left", "use", "uses", "used", "talk", "talks", "talked", "show", "shows",
    "showed", "hear", "hears", "heard", "play", "plays", "played", "run", "runs",
    "ran", "move", "moves", "moved", "live", "lives", "lived", "believe", "believes",
    "believed", "hold", "holds", "held", "bring", "brings", "brought", "happen",
    "happens", "happened", "write", "writes", "wrote", "sit", "sits", "sat",
    "stand", "stands", "stood", "lose", "loses", "lost", "pay", "pays", "paid",
    "meet", "meets", "met", "include", "includes", "included", "continue", "continues",
    "set", "sets", "learn", "learns", "learned", "change", "changes", "changed",
    "lead", "leads", "led", "understand", "understands", "understood", "watch",
    "watches", "watched", "follow", "follows", "followed", "stop", "stops", "stopped",
    "create", "creates", "created", "speak", "speaks", "spoke", "read", "reads",
    "allow", "allows", "allowed", "add", "adds", "added", "spend", "spends", "spent",
    "grow", "grows", "grew", "open", "opens", "opened", "walk", "walks", "walked",
    "win", "wins", "won", "offer", "offers", "offered", "remember", "remembers",
    "love", "loves", "loved", "consider", "considers", "considered", "appear",
    "appears", "appeared", "buy", "buys", "bought", "wait", "waits", "waited",
    "serve", "serves", "served", "die", "dies", "died", "send", "sends", "sent",
    "expect", "expects", "expected", "build", "builds", "built", "stay", "stays",
    "fall", "falls", "fell", "cut", "cuts", "reach", "reaches", "reached", "kill",
    "kills", "killed", "remain", "remains", "remained", "suggest", "suggests",
    "raise", "raises", "raised", "pass", "passes", "passed", "sell", "sells",
    "sold", "require", "requires", "required", "report", "reports", "reported",
    "decide", "decides", "decided", "pull", "pulls", "pulled"
  ]);

  const keywords: string[] = [];

  facts.forEach(fact => {
    // Convert to lowercase and split into words
    const words = fact.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length > 4 && // At least 5 characters - more selective
        !stopWords.has(word) &&
        !/^\d+$/.test(word) && // Not just numbers
        !word.endsWith("ing") || word.length > 7 // Avoid short gerunds
      );
    
    // Only add single words that are likely nouns/topics (5+ chars)
    const meaningfulWords = words.filter(w => w.length >= 5);
    keywords.push(...meaningfulWords);

    // Only extract meaningful bigrams (phrases that represent specific topics/hobbies)
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];
      // Both words must be substantial (5+ chars) and not stop words
      if (!stopWords.has(word1) && !stopWords.has(word2) && 
          word1.length >= 5 && word2.length >= 5) {
        keywords.push(`${word1} ${word2}`);
      }
    }
  });

  // Further deduplicate and return
  return [...new Set(keywords)];
}

// Calculate similarity between two strings (Levenshtein distance)
function isSimilar(str1: string, str2: string): boolean {
  // Exact match
  if (str1 === str2) return true;

  // One contains the other
  if (str1.includes(str2) || str2.includes(str1)) return true;

  // Similar length words with small edit distance
  if (Math.abs(str1.length - str2.length) > 3) return false;

  const minLength = Math.min(str1.length, str2.length);
  if (minLength < 4) return false;

  // Count matching characters at the start
  let matchCount = 0;
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) matchCount++;
  }

  // If 70% or more characters match at the start, consider them similar
  return matchCount / minLength >= 0.7;
}

// Find common keywords between two users (with fuzzy matching)
function findCommonKeywords(keywords1: string[], keywords2: string[]): string[] {
  const common: string[] = [];
  const matched = new Set<string>();

  keywords1.forEach(kw1 => {
    keywords2.forEach(kw2 => {
      if (!matched.has(kw2) && isSimilar(kw1, kw2)) {
        common.push(kw1);
        matched.add(kw2);
      }
    });
  });

  return common;
}

interface UserNode {
  id: string;
  name: string;
  email?: string;
  image?: string;
  keywords: string[];
  type: "user";
}

interface KeywordNode {
  id: string;
  name: string;
  type: "keyword";
  userCount: number; // How many users have this keyword
}

type GraphNode = UserNode | KeywordNode;

interface Connection {
  source: string;
  target: string;
  type: "user-keyword" | "keyword-user";
}

export interface NetworkGraph {
  nodes: GraphNode[];
  links: Connection[];
}

// Get user's network based on shared keywords
export const getUserNetwork = query({
  args: {},
  returns: v.object({
    nodes: v.array(v.object({
      id: v.string(),
      name: v.string(),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      keywords: v.optional(v.array(v.string())),
      type: v.string(),
      userCount: v.optional(v.number()),
    })),
    links: v.array(v.object({
      source: v.string(),
      target: v.string(),
      type: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { nodes: [], links: [] };
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1])
      )
      .unique();

    if (!currentUser) {
      return { nodes: [], links: [] };
    }

    // Get ALL conversations in the system (not just current user's)
    const allConversations = await ctx.db
      .query("conversations")
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    console.log("Total conversations found:", allConversations.length);

    // Get ALL unique users from ALL conversations
    const userIds = new Set<Id<"users">>();
    userIds.add(currentUser._id);

    allConversations.forEach(conv => {
      if (conv.initiatorUserId) userIds.add(conv.initiatorUserId);
      if (conv.scannerUserId) userIds.add(conv.scannerUserId);
    });

    console.log("Total unique users found:", userIds.size);

    // Build user nodes with their facts/keywords
    const userNodesMap = new Map<string, UserNode>();

    for (const userId of userIds) {
      const user = await ctx.db.get(userId);
      if (!user) continue;

      // Get all facts for this user
      const userFacts = await ctx.db
        .query("conversationFacts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      // Extract all facts
      const allFacts = userFacts.flatMap(cf => cf.facts);
      const keywords = extractKeywords(allFacts);

      console.log(`User ${user.name || user.email}:`, {
        factsCount: allFacts.length,
        keywordsCount: keywords.length,
        facts: allFacts,
        keywords: keywords.slice(0, 20) // First 20 keywords
      });

      userNodesMap.set(userId, {
        id: userId,
        name: user.name || "Unknown",
        email: user.email,
        image: user.image,
        keywords,
        type: "user",
      });
    }

    // Create keyword nodes and connections
    const keywordNodeMap = new Map<string, KeywordNode>();
    const keywordToCanonical = new Map<string, string>(); // Map similar keywords to canonical form
    const connections: Connection[] = [];
    const userList = Array.from(userNodesMap.values());

    console.log("Creating keyword nodes from", userList.length, "users");

    // First pass: deduplicate similar keywords
    const allKeywords = new Set<string>();
    userList.forEach(user => {
      user.keywords.forEach(kw => allKeywords.add(kw));
    });

    const keywordList = Array.from(allKeywords);
    
    // Find canonical form for each keyword (group similar ones)
    keywordList.forEach(keyword => {
      let foundSimilar = false;
      
      // Check if this keyword is similar to any existing canonical keyword
      for (const [canonical, _] of keywordNodeMap) {
        const canonicalName = canonical.replace("keyword:", "");
        if (isSimilar(keyword, canonicalName)) {
          keywordToCanonical.set(keyword, canonical);
          foundSimilar = true;
          break;
        }
      }
      
      // If no similar keyword found, this becomes a canonical keyword
      if (!foundSimilar) {
        const keywordId = `keyword:${keyword}`;
        keywordToCanonical.set(keyword, keywordId);
        keywordNodeMap.set(keywordId, {
          id: keywordId,
          name: keyword,
          type: "keyword",
          userCount: 0,
        });
      }
    });

    // Second pass: build connections using canonical keywords
    userList.forEach(user => {
      const usedKeywords = new Set<string>(); // Prevent duplicate connections from same user
      
      user.keywords.forEach(keyword => {
        const canonicalId = keywordToCanonical.get(keyword);
        if (!canonicalId || usedKeywords.has(canonicalId)) return;
        
        usedKeywords.add(canonicalId);
        
        // Increment user count for this keyword
        const keywordNode = keywordNodeMap.get(canonicalId)!;
        keywordNode.userCount++;
        
        // Create connection from user to keyword
        connections.push({
          source: user.id,
          target: canonicalId,
          type: "user-keyword",
        });
      });
    });

    // Filter to only show keywords shared by at least 2 people
    const sharedKeywordNodes = Array.from(keywordNodeMap.values()).filter(kw => kw.userCount >= 2);
    const sharedKeywordIds = new Set(sharedKeywordNodes.map(kw => kw.id));
    
    // Filter connections to only include shared keywords
    const sharedConnections = connections.filter(conn => sharedKeywordIds.has(conn.target));
    
    console.log("Created", sharedKeywordNodes.length, "shared keyword nodes (filtered from", keywordNodeMap.size, "total)");
    console.log("Created", sharedConnections.length, "connections (filtered from", connections.length, "total)");

    // Combine all nodes
    const allNodes: (UserNode | KeywordNode)[] = [...userList, ...sharedKeywordNodes];

    return {
      nodes: allNodes,
      links: sharedConnections,
    };
  },
});

// Get detailed connection info between current user and another user
export const getConnectionDetails = query({
  args: {
    otherUserId: v.id("users"),
  },
  returns: v.object({
    commonKeywords: v.array(v.string()),
    sharedConversations: v.number(),
    otherUserFacts: v.array(v.string()),
    currentUserFacts: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier.split("|")[1])
      )
      .unique();

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get facts for current user
    const currentUserFacts = await ctx.db
      .query("conversationFacts")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const currentFacts = currentUserFacts.flatMap(cf => cf.facts);

    // Get facts for other user
    const otherUserFacts = await ctx.db
      .query("conversationFacts")
      .withIndex("by_user", (q) => q.eq("userId", args.otherUserId))
      .collect();

    const otherFacts = otherUserFacts.flatMap(cf => cf.facts);

    // Extract keywords
    const currentKeywords = extractKeywords(currentFacts);
    const otherKeywords = extractKeywords(otherFacts);
    const commonKeywords = findCommonKeywords(currentKeywords, otherKeywords);

    // Count shared conversations
    const conversationsAsInitiator = await ctx.db
      .query("conversations")
      .withIndex("by_initiator", (q) => q.eq("initiatorUserId", currentUser._id))
      .filter((q) => q.eq(q.field("scannerUserId"), args.otherUserId))
      .collect();

    const conversationsAsScanner = await ctx.db
      .query("conversations")
      .withIndex("by_scanner", (q) => q.eq("scannerUserId", currentUser._id))
      .filter((q) => q.eq(q.field("initiatorUserId"), args.otherUserId))
      .collect();

    return {
      commonKeywords,
      sharedConversations: conversationsAsInitiator.length + conversationsAsScanner.length,
      otherUserFacts: otherFacts,
      currentUserFacts: currentFacts,
    };
  },
});
