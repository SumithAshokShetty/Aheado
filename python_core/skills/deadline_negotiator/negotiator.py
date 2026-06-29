import json
import urllib.request
import urllib.error
import sys
import time
import os
from typing import Dict, Any
from python_core.adk import Agent

# Ensure python_core is in path for utility imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from utils.api_retry import call_api_with_retry

class DeadlineNegotiatorSkill(Agent):
    """
    Specialized skill agent focused on academic deadlines, portal navigation,
    and schedule buffer negotiation.
    """
    def __init__(self, api_keys: list = None):
        self.api_keys = api_keys or []

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes deadline negotiation logic.
        Queries Gemini to dynamically construct reschedules, plans, and summaries based on the input scenario.
        """
        scenario_text = context.get("scenario", "")
        if not scenario_text:
            # Fallback if no scenario text is provided
            scenario_text = "I have an organic chemistry lab due in 3 hours, a math midterm tomorrow morning that I haven't started studying for, and an advisor sync that overlaps with a mandatory group project presentation."

        if not self.api_keys:
            return {
                "status": "ORCHESTRATION_ERROR",
                "error": "GEMINI_API_KEYS not found in skill agent"
            }

        system_timestamp = os.environ.get("CURRENT_SYSTEM_TIMESTAMP") or context.get("currentTime") or ""

        user_profile = context.get("userProfile") or {"name": "Sumith Shetty", "email": "sumithshetty451@gmail.com"}
        user_name = user_profile.get("name", "Sumith Shetty")
        user_email = user_profile.get("email", "sumithshetty451@gmail.com")

        prompt = f"""
        You are Aheado Proactive Agent Core. Analyze the following user crisis scenario:
        "{scenario_text}"
        
        CURRENT SYSTEM TIMESTAMP (Unified Date & Time Anchor Floor):
        "{system_timestamp}"

        GLOBAL USER IDENTITY CONTEXT:
        - User Name: {user_name}
        - User Email: {user_email}

        STRUCTURAL FIELD SYNCHRONIZATION AND DATA EXTRACTION CONSTRAINTS:
        1. DYNAMIC INBOUND METADATA BINDING:
           - You MUST actively inspect the header metadata attributes of the incoming alert or communication string provided in the execution context payload.
           - Locate the explicit source identity parameter (e.g., the sender or author identifier/email) from the primary ingestion stream.
           - Extract that exact original sender identity string and map it directly into the "recipientEmail" (the "To:" recipient destination field) for all generated strategy configurations, ensuring emails are addressed to the true origin party. Do NOT leave dummy text or placeholder variables in "recipientEmail".
        2. LOGICAL CROSS-FIELD TEXT INJECTION:
           - You are STRICTLY PROHIBITED from generating bracketed text placeholders (e.g., [EVENT NAME A], [EVENT NAME B], [TIME A], [TIME B], [Recipient], [Your Name], etc.) or dummy variables anywhere inside the human-readable email body string "outputDraft" or any other field.
           - You must dynamically read the exact date and time value tokens resolved by your calendar checking layer for the active strategy track (the recommendedDate and recommendedTime).
           - Inject those identical resolved date and time variable strings seamlessly into the corresponding text segments within the generated email body message block ("outputDraft"). All events and recipients MUST be fully resolved to real values matching the scenario text.
        3. DYNAMIC PROFILE SIGN-OFF:
           - You MUST read the global user identity variables (User Name: {user_name}, User Email: {user_email}) injected into the runtime environment context to sign off the message body ("outputDraft") naturally, entirely eliminating placeholder sign-off brackets like [Your Name] or [Your Name/Email].

        TEMPORAL CHRONOLOGY & DATE-TIME BOUNDARY CONSTRAINTS:
        1. UNIFIED DATETIME CHRONOLOGY ENFORCEMENT:
           - You MUST treat the "CURRENT SYSTEM TIMESTAMP" as a strict chronological floor boundary (representing BOTH date and time together).
           - Every proposed alternative slot (including "recommendedDate" and "recommendedTime" in conflict option A/B) MUST evaluate as strictly greater than (in the future of) this system timestamp anchor. Proposing a past time on a current date or an entirely past date is a critical system failure. Do NOT make slots in the past.
        2. BOUNDARY ROLLOVER LOGIC:
           - You MUST perform real calendar and clock math: If the current system time is near or past the end of the standard business day (5:00 PM) on the current date, you MUST automatically increment the date calendar forward to the next logical business day or future target week.
           - Proposing an alternative slot requires calculating forward vectors along a true chronological timeline where both date progression and hourly progression change dynamically based on the input context.
           - Ensure that the suggested rescheduled date is always in the format "YYYY-MM-DD" and the time is in the format "HH:MM" (24-hour) or standard "HH:MM AM/PM" format, and must represent a logical future moment.

        CRITICAL RULE FOR ASSIGNMENTS & DEADLINES:
        1. Do NOT consider Google Classroom deadlines, assignments, or coursework as conflicts or clashes with calendar events or emails. 
        2. Only identify and generate rescheduling conflict options (with "isConflictOption": true, e.g. option a/b) for direct conflicts between Google Calendar events and Gmail schedule requests.
        3. If and only if there are actual Google Classroom deadlines or coursework assignments listed in the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section of the scenario text, you MUST append a coursework assignment shield object (with "isConflictOption": false) for EACH real coursework assignment to the "intercepts" array.
        4. You MUST ONLY extract and use the exact title, course name, and due date of the coursework assignments found under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section of the scenario text. Do NOT invent, make up, or hallucinate any coursework titles or details that are not explicitly present under that section.
        5. If there are no coursework assignments listed under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section, the intercepts list must ONLY contain the calendar conflict options, with exactly ZERO assignment shields.
        6. STRICT NEGATIVE DIRECTIVE: You are strictly forbidden from creating mock or hallucinated coursework assignment shields. If there are no assignments under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section, you MUST NOT generate any assignment shield. Do NOT make up, invent, prefill, or reference any default or mock subjects (like physics, math, or chemistry) unless they are explicitly present in the incoming student deadlines.
        
        STUDY OUTLINE STEP DECOUPLING RULES:
        1. You are strictly forbidden from copy-pasting the exact coursework title for both Step 1 and Step 2 of the "outputDraft" study outline.
        2. Instead, you MUST dynamically generate 2-3 distinct, logical, and practical sequential milestone tasks/sub-tasks customized for the specific assignment's subject matter (e.g., 'Step 1: Outlining and core concepts review', 'Step 2: Practical implementation and problem-solving', 'Step 3: Verification and final compilation').

        RESOURCE ACCELERATION & EDUCATIONAL ASSISTANCE RULES:
        1. DYNAMIC TOP-TIER CREATOR EXTRACTION:
           - Analyze the parsed domain, metadata, and core subject of the incoming assignment or workspace crisis (e.g., Machine Learning, Organic Chemistry, Linear Algebra, Project Management, Computer Science, Economics). Do NOT assume, prefill, or reference any default subject if no academic topic or homework is mentioned in the input text.
           - Instead of using a fixed list, dynamically retrieve from your own pre-trained knowledge base the top 2 most authoritative, globally trusted, and highly rated educational creators or channels for that specific technical domain (for example, if Machine Learning, creators like "StatQuest" or "3Blue1Brown"; if Chemistry, creators like "The Organic Chemistry Tutor" or "CrashCourse"; if Project Management, creators like "Adriana Girdler" or "Google Career Certificates").
        2. STRUCTURED LINK CONFIGURATION SCHEMA:
           - For each of the top 2 extracted creators, format a tightly scoped, URL-encoded YouTube search query string focusing on the specific chapter or topic title combined with the creator's name.
           - Format: `https://www.youtube.com/results?search_query=[URL-encoded+Topic+Name]+[URL-encoded+Dynamically+Extracted+Creator+Name]`
        3. TRANSACTIONAL STATE SYNC:
           - You MUST output these exact dynamic resources consistently across both payload outputs:
             A. Within the "recommended_resources" JSON array as objects containing "title", "creator_name", and "url".
             B. Appended cleanly as a matching postscript at the very bottom of the generated email body string "outputDraft" (in BOTH conflict options and coursework assignment shields if they relate to academic tasks):
                "PS: To clear this blocker quickly, review these highly rated concept breakdowns on YouTube:
                - [Topic Title] by [Creator A Name]: [Link A]
                - [Topic Title] by [Creator B Name]: [Link B]"
        4. If there are NO academic tasks, coursework assignments, or project crises in the scenario (i.e., only professional meetings/emails with no educational content), generate an empty array `[]` for "recommended_resources".
        
        We need to generate a structured recovery payload to decouple the user's schedule. 
        Your response must be strict JSON matching this schema:
        {{
            "status": "DRAFT_STAGED",
            "summary": "A detailed synthesis paragraph describing the user's high-pressure situation, assignments due, and the specific calendar conflicts detected.",
            "intercepts": [
                {{
                    "id": "int-calendar-option-a",
                    "isConflictOption": true,
                    "title": "RESCHEDULE [EVENT NAME A] (OPTION A)",
                    "description": "Your [EVENT NAME A] at [TIME A] directly conflicts with [EVENT NAME B]. This option proposes rescheduling [EVENT NAME A].",
                    "category": "calendar",
                    "resolutionTarget": "A",
                    "eventImportance": 60,
                    "action_type": "APPROVE",
                    "eventName": "EVENT NAME A",
                    "recipientEmail": "Extract the actual email of the sender of the conflicting/rescheduling email from the scenario text (e.g., hr@globaltech.com or interviewer@techcorp.com). If no email is mentioned in the text, use a realistic one like advisor@aheado.io or similar, but NEVER use a generic placeholder like recruiting@example.com if a real/sender email is present in the scenario text.",
                    "actionTaken": "Drafted an email to propose rescheduling the event.",
                    "outputDraft": "Subject: Request to Reschedule [EVENT NAME A] - [Your Name]\n\nDear [Recipient],\n\nI have a conflict due to [EVENT NAME B]... Could we reschedule?\n\nBest,\n[Your Name]",
                    "recommendedDate": "YYYY-MM-DD (must be dynamically calculated logical future date strictly > CURRENT SYSTEM TIMESTAMP)",
                    "recommendedTime": "HH:MM (must be dynamically calculated logical future time strictly > CURRENT SYSTEM TIMESTAMP)"
                }},
                {{
                    "id": "int-calendar-option-b",
                    "isConflictOption": true,
                    "title": "RESCHEDULE [EVENT NAME B] (OPTION B)",
                    "description": "Your [EVENT NAME B] at [TIME B] directly conflicts with [EVENT NAME A]. This option proposes rescheduling [EVENT NAME B].",
                    "category": "calendar",
                    "resolutionTarget": "B",
                    "eventImportance": 98,
                    "action_type": "APPROVE",
                    "eventName": "EVENT NAME B",
                    "recipientEmail": "Extract the actual email of the sender of the conflicting/rescheduling email from the scenario text (e.g., hr@globaltech.com or interviewer@techcorp.com). If no email is mentioned in the text, use a realistic one like team@aheado.io or similar, but NEVER use a generic placeholder like recruiting@example.com if a real/sender email is present in the scenario text.",
                    "actionTaken": "Drafted an email to propose rescheduling the event.",
                    "outputDraft": "Subject: Request to Reschedule [EVENT NAME B] - [Your Name]\\n\\nDear [Recipient],\\n\\nI have a conflict due to [EVENT NAME A]... Could we reschedule?\\n\\nBest,\\n[Your Name]",
                    "recommendedDate": "YYYY-MM-DD (must be dynamically calculated logical future date strictly > CURRENT SYSTEM TIMESTAMP)",
                    "recommendedTime": "HH:MM (must be dynamically calculated logical future time strictly > CURRENT SYSTEM TIMESTAMP)"
                }}
            ],
            "recommended_resources": [
                {{
                    "title": "Review [TOPIC] Tutorials on YouTube",
                    "creator_name": "Dynamically Extracted Creator Name",
                    "url": "https://www.youtube.com/results?search_query=[URL-Encoded+Topic]+[URL-Encoded+Creator+Name]"
                }}
            ],
            "verification_card": {{
                "ui_component": "DraftApprovalCard",
                "title": "🛡️ Calendar Decoupling Options Generated",
                "severity": "CRITICAL",
                "actions": [
                    {{"label": "Approve Rescheduling Option A", "event_id": "int-calendar-option-a", "action_type": "APPROVE"}},
                    {{"label": "Approve Rescheduling Option B", "event_id": "int-calendar-option-b", "action_type": "APPROVE"}}
                ]
            }}
        }}

        If there are coursework assignments in "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES", append them to the "intercepts" array using this exact format structure:
        {{
            "id": "shield-assignment-[unique-slug-or-id]",
            "isConflictOption": false,
            "title": "PRIORITIZE [EXACT COURSEWORK TITLE FROM SCENARIO]",
            "category": "assignment",
            "urgency": "CRITICAL",
            "description": "[EXACT COURSEWORK TITLE FROM SCENARIO] is due at [DUE TIME FROM SCENARIO]. A focus block is scheduled to maximize preparation.",
            "actionTaken": "Blocked a focus session and drafted a reminder.",
            "outputDraft": "📚 STUDY OUTLINE:\\n- [Logical, distinct, practical Step 1 customized to coursework subject, e.g. Outlining and resource assembly]\\n- [Logical, distinct, practical Step 2 customized to coursework subject, e.g. Core content creation and problem solving]\\n- [Logical, distinct, practical Step 3 customized to coursework subject, e.g. Verification, review and submission]\\n\\nPS: To clear this blocker quickly, review these highly rated concept breakdowns on YouTube:\\n- [EXACT COURSEWORK TITLE] by [Creator A Name]: [URL-Encoded Link A]\\n- [EXACT COURSEWORK TITLE] by [Creator B Name]: [URL-Encoded Link B]",
            "sprintBreakdown": "⏱️ Suggested Sprint Breakdown:\\n• 00-30 mins: Read Guidelines & Research Requirements\\n• 30-90 mins: Solve core problems & draft structural points\\n• 90-120 mins: Assemble final review and submit coursework"
        }}

        Ensure all fields are dynamically populated and specifically customized for the input scenario text. Do not wrap in markdown or add notes outside the JSON block. Return valid JSON only.
        """

        data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        }

        try:
            url_template = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={key}"
            headers = {"Content-Type": "application/json"}
            result = call_api_with_retry(url_template, data, headers, self.api_keys)
            raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
            res_dict = json.loads(raw_text)
            
            # Post-process and sanitize to filter out hallucinations of instructions/examples
            scenario_lower = scenario_text.lower()
            import re
            
            # Extract actual classroom deadlines from the scenario_text if present under GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES
            actual_deadlines_dicts = []
            classroom_lines = scenario_text.split("\n")
            in_classroom = False
            current_course = ""
            current_title = ""
            for line_item in classroom_lines:
                trimmed = line_item.strip()
                if "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES:" in trimmed:
                    in_classroom = True
                    continue
                if in_classroom and (trimmed.startswith("LATEST CALENDAR EVENTS:") or trimmed.startswith("LATEST INBOX EMAILS:") or trimmed.startswith("Does this state present")):
                    in_classroom = False
                if in_classroom:
                    if trimmed.startswith("- COURSE:") or trimmed.startswith("COURSE:"):
                        if current_title:
                            actual_deadlines_dicts.append({"title": current_title, "course": current_course})
                        current_course = trimmed.replace("- COURSE:", "").replace("COURSE:", "").strip()
                        current_title = ""
                    elif trimmed.startswith("TITLE:"):
                        current_title = trimmed.replace("TITLE:", "").strip()
                    elif trimmed.startswith("- TITLE:"):
                        current_title = trimmed.replace("- TITLE:", "").strip()
                    elif trimmed.startswith("-"):
                        m = re.search(r'- "([^"]+)"| - ([^"]+)', trimmed)
                        if m:
                            val = m.group(1) or m.group(2)
                            if val and not val.lower().startswith("course:") and not val.lower().startswith("title:"):
                                actual_deadlines_dicts.append({"title": val, "course": ""})
            if current_title:
                actual_deadlines_dicts.append({"title": current_title, "course": current_course})

            actual_deadlines = [d["title"] for d in actual_deadlines_dicts]

            # Sanitize intercepts
            if "intercepts" in res_dict and isinstance(res_dict["intercepts"], list):
                sanitized_intercepts = []
                for intercept in res_dict["intercepts"]:
                    if not isinstance(intercept, dict):
                        continue
                    title = intercept.get("title", "")
                    desc = intercept.get("description", "")
                    is_conflict = intercept.get("isConflictOption", False)
                    category = intercept.get("category", "")
                    
                    title_lower = title.lower()
                    forbid_kws = ["phys", "phyi", "phyc", "quantum", "chemistry", "midterm"]
                    has_forbid = any(kw in title_lower for kw in forbid_kws)
                    
                    if has_forbid:
                        actual_mention = any(kw in scenario_lower for kw in forbid_kws)
                        if not actual_mention:
                            if is_conflict:
                                # Safe rename of event titles/descriptions
                                for kw in forbid_kws:
                                    title = re.sub(kw, "Workspace Event", title, flags=re.IGNORECASE)
                                    desc = re.sub(kw, "Workspace Event", desc, flags=re.IGNORECASE)
                                intercept["title"] = title
                                intercept["description"] = desc
                            else:
                                # Coursework shield: map to actual classroom deadline if available, otherwise filter out!
                                if actual_deadlines:
                                    first_dl = actual_deadlines[0]
                                    intercept["title"] = f"PRIORITIZE {first_dl.upper()}"
                                    intercept["description"] = f"{first_dl} is due. A focus block is scheduled to maximize preparation."
                                    if "outputDraft" in intercept:
                                        intercept["outputDraft"] = re.sub(r'phys|phyi|phyc|quantum|chemistry|midterm', first_dl, intercept["outputDraft"], flags=re.IGNORECASE)
                                else:
                                    # No actual coursework, drop this hallucinated shield completely!
                                    continue
                    sanitized_intercepts.append(intercept)
                res_dict["intercepts"] = sanitized_intercepts

            if "recommended_resources" in res_dict and isinstance(res_dict["recommended_resources"], list):
                sanitized_resources = []
                for res in res_dict["recommended_resources"]:
                    if not isinstance(res, dict):
                        continue
                    title = res.get("title", "")
                    url = res.get("url", "")
                    creator = res.get("creator_name", "")
                    # Filter out placeholders
                    if not title or not url or "[topic]" in title.lower() or "[url-encoded" in url.lower():
                        continue
                    
                    title_lower = title.lower()
                    url_lower = url.lower()
                    creator_lower = creator.lower()

                    if not actual_deadlines_dicts:
                        continue

                    # Ensure resource matches one of the actual dynamic deadlines
                    is_matched = False
                    for dl in actual_deadlines_dicts:
                        dl_title_lower = dl["title"].lower()
                        dl_course_lower = dl["course"].lower()

                        if dl_title_lower in title_lower or dl_title_lower in url_lower or dl_title_lower in creator_lower:
                            is_matched = True
                            break
                        if dl_course_lower and (dl_course_lower in title_lower or dl_course_lower in url_lower or dl_course_lower in creator_lower):
                            is_matched = True
                            break

                        stop_words = {"and", "the", "to", "for", "of", "in", "chapter", "introduction", "a", "an", "on", "with", "at", "by", "from", "tutorials", "on", "youtube", "review"}
                        dl_title_words = [w for w in re.split(r'[^a-z0-9]+', dl_title_lower) if len(w) > 2 and w not in stop_words]
                        dl_course_words = [w for w in re.split(r'[^a-z0-9]+', dl_course_lower) if len(w) > 2 and w not in stop_words]

                        for word in dl_title_words + dl_course_words:
                            if word in title_lower or word in url_lower or word in creator_lower:
                                is_matched = True
                                break
                        if is_matched:
                            break

                    if not is_matched:
                        continue
                    
                    # Forbid template hallucination keywords unless explicitly present in scenario text
                    is_hallucinated = False
                    forbid_kws = ["phys", "phyi", "phyc", "quantum", "chemistry", "midterm", "machine learning", "linear algebra"]
                    for kw in forbid_kws:
                        if kw in title_lower and kw not in scenario_lower:
                            is_hallucinated = True
                            break
                    if is_hallucinated:
                        continue
                        
                    sanitized_resources.append(res)
                
                res_dict["recommended_resources"] = sanitized_resources
            
            return res_dict
        except Exception as e:
            error_message = f"{type(e).__name__}"
            if isinstance(e, urllib.error.HTTPError):
                error_message = f"{error_message} (Code: {e.code})"
            
            sys.stderr.write(f"ERROR: Failed during AI generation in skill negotiator. {error_message}, Message: {e}\n")
            return {
                "status": "ORCHESTRATION_ERROR",
                "error": f"AI service error: {error_message}"
            }
