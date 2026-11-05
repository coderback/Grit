# Nutrition-app refresh, all-in-one health platforms and business models: GRIT competitive landscape (as of 5 Nov 2026)

> **Method note.** Page fetches to revenuecat.com, techeconomy.ng and mycallie.app failed with DNS blocks in this session, so these notes rest on search-result extracts from the cited pages. Dated items are labelled. Vendor blogs (Nutrola, NutriScan, Fitia, SensAI) appear only as signals and are marked as such. The earlier docs/MARKET_RESEARCH.md already covers MFP, Lose It!, Cronometer, MacroFactor, Cal AI, Yazio, Lifesum, Noom and Carbon basics, including the NUTRITION 2026 study that found photo AI underestimates by about 33%. Those basics are not repeated here.

## Q1. Nutrition: new or deeper angles (meal planning and grocery, recipes, restaurants, alcohol and hydration, non-diet approaches and eating-disorder risk, accuracy studies)

### Takeaway
Two things have moved since the last file: **accuracy research** and the **emotional and safety cost of tracking**. Photo-only AI still misses energy by roughly 30–36%. Once the user supplies the ingredients, the error falls to about 14%, and a model fine-tuned on regional food beats dietitians. Meal planning and grocery are commoditised and cheap ($5/mo, $40–60/yr) and still sit in separate apps. Evidence is building that rigid calorie tracking produces shame and disordered eating, so non-diet modes and safeguards are becoming a way to stand out rather than a niche.

### Cited Findings
**AI photo and estimation accuracy (2025–2026)**
- Fridolfsson et al., *Current Developments in Nutrition* (2025), tested 52 photos of weighed food. GPT-4o's mean energy error was about 35.8% and Gemini 1.5 Pro's about 64.2%, and every model underestimated more as portions grew. These figures come from secondary summaries; I did not read the paper, so they are **unverified**. — [Calorix summary](https://calorix.ai/blog/can-chatgpt-count-calories/); [Callie summary](https://www.mycallie.app/en/blog/can-chatgpt-count-calories)
- A *Nutrients* (2025) study of ChatGPT-5 found about 30.5% error from the photo alone and about 13.9% when ingredients were supplied (secondary summary, **unverified**). The same pattern explains why GRIT's text and dictation route plus database grounding is the right design. — [Callie](https://www.mycallie.app/en/blog/ai-calorie-accuracy-research)
- On 15 standardised hospital meals, 10 registered dietitians were compared with 10 AI models. The best models (including GPT-4o) matched the dietitians on energy and carbohydrate, often within ±10%. Every AI model was significantly worse on **protein and fat**. — [PubMed 41901141](https://pubmed.ncbi.nlm.nih.gov/41901141/)
- GPT-4o fine-tuned on 1,269 photos of Japanese meals **beat dietitians on all nutrients**, and plain GPT-4o was strong but not consistently better. Training on regional food closes the gap, which is directly relevant to a West African food layer. — [PubMed 42410932](https://pubmed.ncbi.nlm.nih.gov/42410932/)
- Research (arXiv, 2025–26) is moving toward knowledge-grounded, agentic decomposition (Open-KNEAD) and image+text pairing to improve calorie estimates. This is the same architecture as GRIT's "memory → DB → checked estimate". — [Open-KNEAD arXiv 2607.12911](https://arxiv.org/pdf/2607.12911); [arXiv 2511.11705](https://arxiv.org/pdf/2511.11705)
- A NUTRITION 2026 study of 102 meals (already covered in the earlier file) found Cal AI, Lose It! and MFP photo features underestimate energy by about a third. — [Nutritional Outlook](https://www.nutritionaloutlook.com/view/study-finds-popular-ai-calorie-tracking-apps-underestimate-meal-energy-by-about-a-third)

**Food-database accuracy**
- No 2025–26 peer-reviewed head-to-head of Cronometer vs MFP against USDA turned up. The most recent peer-reviewed signal is a 2024 validation in Filipino adults with obesity: MFP **underestimated energy, carbohydrate and fat** compared with the Philippine FCT, and the authors attribute this to unchecked user-submitted entries. — [Fitia blog summarising the study (vendor)](https://fitia.app/learn/article/best-calorie-counter-app-accurate-food-database/)
- Vendor benchmarks claim Cronometer and the vendor's own app cluster tightly while MFP and Cal AI show 2–3× more error across 500 foods. The vendor ran the test, so there is a **conflict of interest**. — [Nutrola 2026 data report](https://nutrola.app/en/blog/database-accuracy-head-to-head-nutrola-vs-myfitnesspal-vs-cal-ai-vs-cronometer-data-report-2026)
- Cal AI has now been wired into MFP's crowdsourced database after the acquisition. The photo app has inherited MFP's data-quality problem. — [Appetizer Mobile, 2 Mar 2026](https://appetizermobile.com/2026/03/02/myfitnesspal-acquires-cal-ai/)

**Meal planning, grocery and recipes**
- Eat This Much (May 2026): free tier, Premium about $5/mo billed annually or $14.99 month-to-month, and a Professional tier for coaches priced per client. It sends grocery lists to Instacart or AmazonFresh. Third-party prices conflict ($8.99–9/mo, $60/yr). — [ProMealPlan review 2026](https://www.promealplan.com/en/blog/eat-this-much-review-2026); [Stork.ai](https://www.stork.ai/en/eat-this-much)
- Mealime: free, Pro $5.99/mo or $49.99/yr. Instacart and Amazon Fresh export is claimed but **unverified**. — [Fitia meal-planning roundup (vendor)](https://fitia.app/learn/article/best-meal-planning-apps-2026/)
- Samsung Food (formerly Whisk): imports recipes from any site, builds AI weekly plans, and reportedly connects to about 23 grocery retailers. Food+ costs about $4.99/mo or $39.99/yr (sources conflict). — [ToolDirectory Aug 2026](https://tooldirectory.ai/tools/samsung-food); [Macaron 2026](https://macaron.im/es/blog/best-meal-planning-apps)
- MFP's Meal Planner, from the 2024 Intent acquisition, is Premium+ only ($99.99/yr). One review says it is the only planner that writes finished meals straight into a calorie diary. I found no confirmed Instacart link. — [CO/AI on Intent acquisition](https://getcoai.com/news/myfitnesspal-acquires-intent-to-combine-meal-planning-grocery-list-creation-and-calorie-tracking-in-one-ai-app/); [Grate comparison](https://grate-six.vercel.app/blog/best-meal-planning-app)
- An **unverified** tracker reports that in May 2026 MFP moved scan-a-meal, recipe-URL import and macro-by-meal goals behind Premium. — [subscription123 price tracker](https://subscription123-1xk.pages.dev/price-hikes/myfitnesspal/)

**Non-diet approaches, shame and eating-disorder risk**
- *British Journal of Health Psychology* (Oct 2025; UCL and Loughborough; DOI 10.1111/bjhp.70026) analysed 58,881 posts about MFP, Strava, WW and two other apps, about 13,799 of them negative. Themes were **shame at logging "unhealthy" food**, irritation at nagging notifications, disappointment with slow progress toward algorithm-set targets, tracking complexity, and data loss. The authors recommend less rigid, weight-focused goals. — [EurekAlert](https://www.eurekalert.org/news-releases/1102616); [diabetes.co.uk May 2026](https://www.diabetes.co.uk/news/2026/may/fitness-trackers-can-shame-users-as-well-as-motivate-them.html)
- *Body Image* (2025) systematic review: young adults who use diet and fitness apps show more disordered-eating symptoms, more so with frequent use. The evidence is not causal, and adolescents are under-studied. — [PubMed 39671845](https://pubmed.ncbi.nlm.nih.gov/39671845/)
- *Journal of Eating Disorders* (2024) longitudinal study: among emerging adults, weight-related self-monitoring apps were associated with **increases in disordered weight-control behaviours** over time. The authors call for screening and monitoring safeguards. — [DOAJ](https://doaj.org/article/4d8f9f868a5641159d0b9b4e60926823)
- An older retrospective study found 73.1% of ED patients said MFP contributed at least somewhat to their eating disorder (self-report, not causal). — [Medical Dialogues](https://medicaldialogues.in/mdtv/psychiatry/videos/study-shows-fitness-apps-may-contribute-to-disordered-eating-behaviors-143662)
- Recovery Record, the clinical ED app, is built around **regular eating patterns, not calories or weight**. It is designed for use alongside a clinician, and clinicians may steer patients who over-count calories away from tracking. — [Healthify NZ](https://healthify.nz/apps/r/recovery-record-app); [Recovery Record help](https://recoveryrecord.helpjuice.com/fundamentals/im-not-sure-if-recovery-record-is-for-me)
- *JMIR Human Factors* (2026), In2Eat: 45 students used an intuitive-eating app for 4 weeks. Diet quality improved **without an increase in disordered eating** (small, short study). — [JMIR HF 2026 e81439](https://humanfactors.jmir.org/2026/1/e81439/PDF)
- A growing set of small "no-calorie" diaries (Munch: lifetime $34.99, $3.99/mo; Eated; Treatwise; MyTummy) log by photo, hunger and fullness. — [Munch App Store](https://apps.apple.com/app/id6757778600); [Eated](https://apps.apple.com/us/app/id6475350108); [Treatwise](https://apps.apple.com/app/id6738762229)
- Oura's Meals feature (May 2025) deliberately avoids calorie counting. It reports protein, fibre, processing level, added sugar and fat, and pairs meals with a Dexcom Stelo CGM ($99). — [Android Central](https://www.androidcentral.com/wearables/oura-ring/oura-can-now-track-meals-and-glucose-parameters-for-us-users); [TechRadar](https://www.techradar.com/health-fitness/your-oura-ring-just-got-a-major-upgrade-that-gives-it-3-handy-new-diet-features)
- Samsung Health assigns a "Diet Score" from its own nutrition-assessment model, a quality score rather than a calorie count. — [BGR](https://www.bgr.com/2292294/new-features-samsung-health-meal-scanning-photos/)

**Restaurant, alcohol and hydration**
- Fitbit/Google added water logging alongside nutrition in its coach. Hydration is now standard in all-in-ones. — [Google blog](https://blog.google/products-and-platforms/devices/fitbit/fitbit-personal-health-coach-new-features)

### Inferences
- The accuracy evidence supports GRIT's current pipeline (memory → database → checked estimate). Photo-only is the weakest mode. Ask for or confirm ingredients, and **double-check fat and protein**, where AI errors are systematically largest (oil, sauces, cooking fat). The earlier file's "cooked in oil?" clarifier is the evidence-backed move.
- Regional fine-tuning beating dietitians on Japanese food points to a defensible GRIT asset. A labelled West African meal-photo corpus, built from user corrections and label contributions, could make GRIT the most accurate app for that cuisine, and incumbents have no incentive to build it.
- Safeguards are now a reputational and regulatory issue as much as an ethical one. A "non-numbers" mode (hide calories and show portions, protein and fibre, or a quality score like Samsung and Oura) would reach the intuitive-eating segment and also lower ED risk. Other safeguards: age gating, minimum-calorie floors (already planned), no shaming notifications, and an ED screen or soft off-ramp.
- Meal planning is cheap, commoditised and fragmented. A coach that generates a plan from a user's own logged foods and pushes a grocery list is a plausible differentiator for an all-in-one, provided it fills the diary automatically.

### Gaps
- No 2025–26 peer-reviewed study found that directly benchmarks app databases against USDA. A reported Oct 2025 *J Hum Nutr Diet* comparison could not be verified.
- No current data on restaurant-logging coverage (e.g., Nutritionix licensing) or alcohol-tracking features.
- No independent evaluation found of MFP's or any mainstream app's ED safeguards.

## Q2. Regional and cultural foods: coverage, regional players, and Nigeria/West Africa realities

### Takeaway
Regional winners exist where a local database was the moat: HealthifyMe built on NIN data for India, and Fitia on country-specific databases for LatAm. West Africa has open composition data (WAFCT 2019, about 1,028 foods) but no scaled consumer nutrition app, only small launches (Zayvo, WELFAS, Platos). Nigeria now has 75% smartphone penetration (2025), mostly Android. Payments remain the hard part: Play Store naira billing exists only via Verve, and web checkout (Paystack) is the developer workaround.

### Cited Findings
**India: HealthifyMe**
- Its database started from Indian food data curated with India's National Institute of Nutrition. A later profile cites 10,000+ regional foods in 13 Indian languages. — [Wikipedia: HealthifyMe](https://en.wikipedia.org/wiki/HealthifyMe); [OpenAI customer story](https://openai.com/index/healthify)
- Snap, its photo AI for Indian food, launched in Sep 2023 claiming 60–70% recognition accuracy. Later company claims range from about 75% to 80% for single dishes. These are company figures, not independent. — [TechCrunch 2023](https://techcrunch.com/2023/09/21/khosla-backed-healthifyme-introduces-ai-powered-image-recognition-for-indian-food); [BusinessToday](https://businesstoday.in/technology/news/story/shazam-for-food-healthifymes-snap-ai-tool-makes-tracking-calories-fun-and-easy-404784-2023-11-08)
- Financials: FY23 operating revenue INR 228.76 Cr (about $28.5M), EBITDA about −$17.3M. Raised $20M (Oct 2024; Khosla, LeapFrog) for US expansion. Users: 35M+ (2024) to about 40M (Jan 2025, secondary). No audited FY24/25 figures found. — [Inc42](https://inc42.com/buzz/healthify-raises-20-mn-for-us-expansion); [Preqin](https://www.preqin.com/data/profile/asset/healthifyme/167539); [Oyelabs (secondary)](https://oyelabs.com/healthifyme-business-model/)
- Its model mixes app subscriptions with **human coaches and dietitians**, plus AI (Ria). — [Oyelabs](https://oyelabs.com/healthifyme-business-model/)

**Latin America: Fitia (Lima, YC S21)**
- 10M+ users (company or press figure). A food database adapted per country, with a user-switchable country setting. Says it avoids unreviewed crowdsourced entries. Revenue about $3.5M (2024, directory estimate, **unverified**). Expanding into the US. — [Fitia help: change database country](https://fitia.app/es/ayuda/articulos/change-food-database-country); [Fitia YC](https://fitia.app/news/fitia-ycombinator/); [Apple App Store story](https://apps.apple.com/us/story/id1529883761); [Promptloop directory](https://www.promptloop.com/directory/what-does-fitia-do)

**West Africa: data assets**
- WAFCT 2019 (FAO/INFOODS) has **1,028 foods and 56 components** (44 nutrients). It updates the 2012 table with about 3× as many foods, and FAO hosts it as a free Excel file. — [FAO Open Knowledge](https://openknowledge.fao.org/handle/20.500.14283/ca7779b); [MDPI Nutrients 16:3497](https://www.mdpi.com/2072-6643/16/20/3497)
- The Nigerian FCT (2017) has 282 foods. The Nigeria Nutrient Conversion Table (Cockx & Custodio, Jun 2025) takes 72.1% of its items from WAFCT 2019, 38 from USDA and 13 from a 2019 Nigeria FCT. — [FAO FCT listing](https://www.fao.org/food-composition/tables-and-databases/detail/nigerian-food-composition-table/en); [Nigeria_NCT, ISCIII repository](https://repisalud.isciii.es/entities/publication/2bd23db3-a295-4745-9d93-002b9f86c13e)
- myfood24 West Africa is an academic project building a Nigeria dietary-assessment tool. A recipe- and dish-level database is the known hard problem. — [Proceedings of the Nutrition Society](https://www.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/assessing-diet-more-accurately-in-nigeria-development-of-myfood24-west-africa/D9D1209BA782B7DAEAC88D515F8AAB60)
- Open-source attempts exist, e.g. NutriClassify, a Nigerian food database with Yoruba, Igbo and Hausa names. — [GitHub README mirror](https://worker-github.zxx930427.workers.dev/Blockchain-Oracle/NutriClassify/blob/main/README.md)

**West Africa: consumer players (all small or early)**
- **Zayvo Fitness** (iOS only): "Snap your jollof, eba or egusi". Combines AI photo calories, GPS runs, workouts and an AI coach. Pro adds Nigerian-food meal plans. — [App Store](https://apps.apple.com/app/id6790803253)
- **WELFAS** (Lagos, 2026): an all-in-one covering fitness tracking, meal-scan calories, AI meal plans and doctor consultations, on iOS and Android. — [BusinessDay](https://businessday.ng/life/article/firm-launches-ai-powered-solution-to-tackle-lifestyle-diseases/)
- **Platos Health** (Lagos): $1.4M pre-seed (May 2025) for an AI metabolic-health device that tracks 49 indicators, aimed at high-income urban consumers. Estimates a $30M+ local opportunity and cites 45M Nigerians overweight or obese and 8M+ with diabetes (company figures). — [TechCabal](https://techcabal.com/2025/05/07/platos-health-raises-pre-seed/); [LaunchBase Africa](https://launchbaseafrica.com/2025/05/07/nigerias-platos-health-raises-1-4m-to-scale-preventive-health-platform-amid-rising-chronic-disease-burden/)
- Web-only Nigerian food calorie calculators cover 50+ dishes and use fist-size portions (e.g., "one wrap of eba = clenched fist"). — [calculators-ng](https://calculators-ng.pages.dev/health/nigerian-food-calorie-calculator); [9japolytv](https://9japolytv.com/free-calorie-calculator-for-nigerian-foods-jollof-rice-yam-beans/)
- A Nigeria-focused design case study argues mainstream trackers fail Nigerian meals (a concept, not a company). — [Health Genius case study](https://rita-chibuike.vercel.app/case-studies/health-genius)
- Global apps (Yazio, MyNetDiary) are listed in Nigeria's stores but are not built for Nigerian food. — [apptail Yazio NG](https://apptail.io/app/yazio-kalorien-zahler-diat-cZf/nigeria)

**South Africa: insurer-driven nutrition**
- Discovery Vitality's HealthyFood benefit gives **up to 75% back** on qualifying healthy groceries at Checkers and Woolworths, activated in the Discovery app. From Sep 2026, members who have not completed health assessments in 3 years drop to 0%. One Reddit user reports 25–30% back. — [Discovery: Vitality 2026 updates](https://www.discovery.co.za/vitality/vitality-benefit-updates-2); [Discovery HealthyFood](https://www.discovery.co.za/vitality/healthy-food); [BusinessTech](https://businesstech.co.za/news/industry-news/789071/nourishing-a-nation-vitality-enhances-healthyfood-benefit/)

**Nigeria: smartphones and payments**
- A KPMG × Orange study (published Sep 2026; 13,251 respondents in 12 cities) puts smartphone penetration at **75% in 2025**, up from 64% in 2023. Feature-phone use fell from 36% to 28%, and **about 88–90% of smartphones run Android**. A Vanguard figure of 85% is not corroborated. A4AI's 44.4% "access" figure measures something different. — [KPMG PDF](https://assets.kpmg.com/content/dam/kpmgsites/ng/pdf/2026/09/Nigeria%20Smartphone%20Study%20-%20Orange%20Group%20and%20KPMG.pdf.coredownload.inline.pdf); [BrandSpur](https://brandspurng.com/2026/09/26/nigerias-smartphone-penetration-rises-to-75-in-2025-kpmg-report-finds/); [EdgeX (Android share)](https://pro.edgex.exchange/en-US/news/article/android-powers-88-of-nigerian-smartphones)
- Google Play has accepted **naira via Verve cards** since July 2023, but only on Android with Verve. Nigerian bank cards being declined on Play is a long-running complaint (anecdotal). — [Techpoint Africa 2023](https://techpoint.africa/2023/07/26/nigerian-verve-purchase-apps-google-naira/); [Mobility.ng](https://mobility.com.ng/nigerian-debit-card-on-google-play-store)
- Developers route subscriptions through **Paystack** (cards, bank transfer, USSD) on web checkout and sync entitlements through RevenueCat. — [DEV.to write-up](https://dev.to/igbojionu/stop-leaving-money-on-the-table-how-i-bridged-paystack-revenuecat-for-my-mobile-app-a-nigerian-f56)
- Carrier billing for Google Play existed through 9mobile's 9pay wallet (2017). No current data found. — [Developing Telecoms](https://developingtelecoms.com/telecom-technology/financial-services/7452-bango-platform-enables-9pay-wallet-for-google-play-users-in-nigeria.html)
- A cost-of-healthy-diet presentation (GAIN, 2025) frames food affordability as the binding constraint in Nigeria. — [GAIN PDF](https://nutritionnigeria.org/wp-content/uploads/2025/10/GAIN-Unerstanding-the-cost-of-a-healthy-diet.pdf)

### Inferences
- The pattern holds across India and LatAm: **a curated local database + local-language names + local portion units = durable regional leader**. Nobody has done this at scale for West Africa, and the free WAFCT 2019 plus Nigeria NCT give GRIT a credible seed. Dish-level recipes (jollof, egusi, eba with swallow portions) and local units (wrap, mudu, cup, "fist") are where value lies, not raw ingredients.
- Nigeria should be treated as **Android-first, low-ARPU, payment-fragile**. Expect Play billing to under-convert. A Paystack web checkout (where store policy allows), naira pricing, weekly or monthly micro-plans, and a generous free tier are required. Discovery's model shows a B2B2C route: insurers and employers pay for healthy behaviour.
- The live Nigerian competitors (Zayvo, WELFAS) already pitch "snap your jollof" all-in-ones. Speed matters, and an accuracy claim on Nigerian dishes backed by a validation study would set GRIT apart.

### Gaps
- No independent test of how MFP, Cronometer, Lose It! or MacroFactor cover African, South Asian, Middle Eastern or Latin American dishes.
- Nothing found on Middle East/Gulf nutrition apps or Arabic-language food databases.
- No user numbers, funding or revenue for Zayvo or WELFAS. No 2025 data on Nigerian app-subscription spend, Play card decline rates or carrier billing.
- Kenya-specific nutrition apps not researched; nothing surfaced.
- Nigeria obesity and diabetes prevalence figures above are company-cited, not from WHO or a national survey.

## Q3. All-in-one platforms: Samsung, Apple, Google/Fitbit, MFP after Cal AI, Noom, WHOOP and Oura, Amazon One Medical

### Takeaway
In 2026 the platform giants all moved toward an AI coach that sits on top of device data and now **includes conversational or photo food logging**. Google launched Health Coach at $9.99/mo and Samsung's Health Assistant is a free beta. Apple **scaled back** its Health+ coach, and WHOOP still has no native food logging. Nutrition in these all-ins is shallow: photo estimates with no published accuracy, no adaptive targets, generic databases, and nothing social. Incumbent nutrition apps are consolidating (MFP plus Cal AI plus Intent) or pivoting to GLP-1 telehealth (Noom, WW).

### Cited Findings
**Apple**
- Feb 2026: Gurman reported Apple **scaled back Project Mulberry / Health+**. The standalone paid AI-coach service was dropped, and pieces will be folded into the Health app as updates. This followed Eddy Cue taking over Health after Jeff Williams retired. — [9to5Mac 5 Feb 2026](https://9to5mac.com/2026/02/05/apple-reportedly-scales-back-plans-for-ai-powered-health-coach/); [MacRumors](https://www.macrumors.com/2026/02/05/apple-reportedly-scales-back-ios-27-feature/); [Business Standard](https://www.business-standard.com/technology/tech-news/apple-ai-health-coach-shelved-project-mulberry-features-arrive-updates-126020601028_1.html)
- WWDC 2026 announced no coach. As of Aug 2026, Gurman expected Mulberry-derived features (blood-sugar tracking, camera-based workout form) in the Health app, but **not in iOS 27's initial release**. Food tracking was in the original plans; its current status is **unconfirmed**. — [9to5Mac 24 May 2026](https://9to5mac.com/2026/05/24/apple-improving-heart-rate-tracking-in-watchos-27-mulberry-health-coach-delays/); [9to5Mac 29 Aug 2026](https://9to5mac.com/2026/08/29/apple-health-revamp-ai-coach-new-apple-watch-next-month/)

**Google (Fitbit → Google Health)**
- The Gemini-powered Personal Health Coach began public preview in Oct 2025 for US Premium Android users, initially without nutrition. — [TechCrunch 27 Oct 2025](https://techcrunch.com/2025/10/27/fitbits-revamped-app-with-gemini-powered-health-coach-rolls-out-to-premium-users/?sidebar=a)
- On 7 May 2026 the Fitbit app was renamed **Google Health**. "Google Health Coach" rolled out globally from 19 May 2026 and covers manual and photo meal logging, conversational logging, macro ranges, water logging and calorie targets. **Google Health Premium is $9.99/mo or $99/yr** (some sources say $99.99; previously $79.99/yr). — [TechCrunch 7 May 2026 (reader mirror)](https://hn.jakechampion.name/reader/https://techcrunch.com/2026/05/07/googles-9-99-per-month-ai-health-coach-launches-may-19/); [iPhone in Canada](https://www.iphoneincanada.ca/2026/05/07/the-fitbit-app-is-dead-google-health-is-taking-over/); [Google blog](https://blog.google/products-and-platforms/devices/fitbit/fitbit-personal-health-coach-new-features); [Smartprix](https://smartprix.com/bytes/google-health-app-launches-with-gemini-ai-coach-and-full-redesign/)
- Google has published **no accuracy data** for its photo macro estimates (per a comparison blog). — [SensAI (vendor)](https://www.sensai.fit/blog/google-health-premium-fitbit-ai-coach-2026)
- Users in Fitbit's own forum asked for photo food logging during the preview, evidence of demand. — [Fitbit community](https://community.fitbit.com/t5/Personal-Health-Coach-Public-Preview/Feature-Suggestion-AI-Photo-Food-Logging/td-p/5827656)

**Samsung**
- Jul 2026: **Samsung Health Assistant** beta for US Galaxy users. It ties together sleep, activity, nutrition, mindfulness and vitals, and is not for diagnosis. — [Samsung Newsroom](https://news.samsung.com/global/samsung-launches-health-assistant-beta-first-fully-integrated-ai-powered-personal-health-assistant); [Droid Life 21 Jul 2026](https://www.droid-life.com/2026/07/21/samsung-health-gets-fully-ai-powered-health-assistant/)
- Scan Meal photographs food and estimates serving, calories and macros. Users can also tell the coach about a meal by text or voice. Samsung Health has **no subscription** today, though assistant pricing is unanswered. — [BGR](https://www.bgr.com/2292294/new-features-samsung-health-meal-scanning-photos/); [Tech-ish](https://tech-ish.com/2026/07/21/samsung-health-assistant-ai-chatbot-beta/)
- At Galaxy Unpacked 2026, Samsung framed a "connected care" vision with partners, extending into the clinical side. — [Samsung Mobile Press](https://samsungmobilepress.com/articles/unpacked-2026-connected-care-future)

**MyFitnessPal after Cal AI**
- Acquisition announced 2 Mar 2026. Cal AI **stays a standalone app** for younger, performance-minded users, while MFP focuses on long-term weight and health ("meet them where they are", CEO Mike Fisher). Cal AI has since been plugged into MFP's database. Cal AI claimed $40M+ in trailing-12-month sales, with about $5.7M peak monthly in Jan 2026 (third-party estimate). The price was not disclosed. — [Athletech News](https://athletechnews.com/myfitnesspal-cal-ai-acquisition); [Pulse 2.0](https://pulse2.com/myfitnesspal-acquires-cal-ai-to-expand-ai-powered-nutrition-tracking-portfolio); [Healthcare.digital analysis](https://www.healthcare.digital/single-post/strategic-consolidation-of-digital-nutrition-analysis-of-the-myfitnesspal-acquisition-of-cal-ai)
- The resulting portfolio is MFP (database, diary, AI Coach, GLP-1), Cal AI (on-ramp) and Intent (meal planning), plus a ChatGPT Health app (Jan 2026). It is a **multi-brand funnel, not one integrated app**. — [CO/AI on Intent](https://getcoai.com/news/myfitnesspal-acquires-intent-to-combine-meal-planning-grocery-list-creation-and-calorie-tracking-in-one-ai-app/)

**Noom and WeightWatchers (behavioural apps turned GLP-1 telehealth)**
- Noom laid off staff in Feb 2025, citing a revenue-mix shift toward GLP-1 offerings. In Apr 2026 it acquired **Tailor Made Compounding**, a 503A pharmacy operating in 46 states. It markets employer "SmartRx" programmes claiming about 80% lower GLP-1 drug costs (company claim via an aggregator). — [MobiHealthNews](https://www.mobihealthnews.com/news/noom-confirms-layoffs-amid-need-build-more-efficient-business); [CNBC link](https://link.cnbc.com/view/5d7c88362c885e3b4657c808mwl1s.zk/2aa4c555); [BriefGlance](https://briefglance.com/articles/nooms-new-model-slashes-employer-glp-1-drug-costs-by-nearly-80)
- WW filed Chapter 11 in May 2025, cutting about $1.15B of debt, and emerged in late June 2025. It pivoted to menopause and WW Clinic (formerly Sequence). Pre-bankruptcy it had 3.4M subscribers, 135k of them clinical. An Apr 2026 credit note says it has slipped back into distress, and a mandatory cash sweep from Jun 2026 constrains spending. — [HIT Consultant](https://hitconsultant.net/2025/07/08/weightwatchers-emerges-from-bankruptcy-launches-new-menopause-program); [Shropshire Star](https://www.shropshirestar.com/uk-news/2025/07/08/weightwatchers-emerges-from-bankruptcy-after-slimming-down-debts); [CreditSights](https://know.creditsights.com/?p=35131)

**WHOOP and Oura**
- WHOOP: **no native food logging found as of Nov 2026**. "Auto-Log Nutrition" imports from MFP, Lose It! and Cronometer through Apple Health. An Apr 2026 community request asks for built-in AI nutrition tracking. WHOOP has signalled glucose-monitoring plans, which need precise food logging. — [WHOOP support](https://support.whoop.com/s/article/Apple-Health-Integration); [WHOOP community](https://www.community.whoop.com/t/product-suggestion-native-ai-nutrition-tracking-inside-whoop/14901); [the5krunner Nov 2025](https://the5krunner.com/2025/11/13/whoop-ipo-glucose-monitoring-plans-2026/)
- Oura: Meals (photo, no calories) and Glucose (Dexcom Stelo, $99) launched in May 2025, US first. No 2026 nutrition update found. — [HIT Consultant](https://hitconsultant.net/2025/05/06/oura-launches-ai-powered-meals-glucose-tracking); [Android Authority](https://www.androidauthority.com/oura-launches-meals-and-glucose-features-3554677/)

**Amazon**
- Jan 2026: Health AI (Bedrock) launched for One Medical members. It reads records, labs and medications, manages prescriptions and books appointments. Mar 2026: opened to **all US customers** on Amazon.com and the app, and Prime members get up to 5 free One Medical message consults. One May 2026 report conflicts on rollout scope. — [Fast Company SA](https://fastcompany.co.za/tech/2026-01-22-amazon-launches-an-ai-chatbot-that-understands-your-health-history/); [The Next Web 11 Mar 2026](https://thenextweb.com/news/amazon-health-ai-launches-website-app-one-medical-prime); [HLTH](https://hlth.com/insights/news/amazon-launches-health-ai-agent-on-its-website-expands-free-virtual-care-to-200m-prime-members-2026-03-16)
- Amazon Health Benefits Connector, an employer-paid digital-health marketplace, added nutrition-therapy provider Berry Street (Apr 2026) and Fay (Sep 2025). Two-thirds of Americans qualify for insurance-covered nutrition counselling, but fewer than 10% receive it. — [Pulse](https://www.pulse.bot/healthcare/news/amazon-teams-up-with-berry-street-to-expand-access-to-nutrition-therapy-38fe29bf-292b-42b5-97b9-3472c2f126df); [HIT Consultant](https://hitconsultant.net/2025/09/16/fay-becomes-first-nutrition-service-to-join-amazon-health-benefits-connector/)

**Where all-in-ones fail**
- Hardware lock-in and data silos: WHOOP relies on third-party apps for food, and users ask for a "true two-way sync" with Cronometer. — [WHOOP community](https://www.community.whoop.com/t/feature-request-true-direct-two-way-sync-between-cronometer-and-whoop/16330)
- Paywalled coaches: Google Health Coach requires Premium, while the free app lacks the coach. — [Android Authority](https://www.androidauthority.com/fitbit-personal-health-coach-new-features-3653938)
- Platform AI promises slip. Apple's Health+ was scaled back after about 2 years of reports. — [MacDailyNews](https://macdailynews.com/2026/02/09/apple-scales-back-plans-for-new-ai-based-health-coach-service/); [The Fit Futurist](https://www.thefitfuturist.com/en/news/apple-ai-health-coach-scaled-back/)

### Inferences
- The threat to GRIT comes from **Google (Android, paid) and Samsung (free, Galaxy-only)**. Both bundle food logging into a cross-domain AI coach. In Nigeria and other Android-heavy markets, Samsung Health's free assistant is the most direct "good enough" substitute if it rolls out internationally.
- Their weaknesses are where GRIT can win. None has adaptive TDEE, a verified or regional database, per-user food memory, accuracy disclosure, or a social and accountability layer. Each is tied to its hardware or OS, so a Samsung user's friend on an iPhone cannot join a challenge.
- MFP is building a funnel of separate apps; Noom and WW are becoming pharmacies. That leaves the integrated "nutrition + training + habits + social + coach" consumer app with no one at scale.

### Gaps
- Whether Samsung Health Assistant has launched outside the US, and its eventual price.
- Whether Apple's iOS 27 point releases include food logging.
- Independent accuracy or retention data for Google Health Coach or Samsung Scan Meal.
- Noom's and WW's 2025–26 revenue and subscriber numbers.

## Q4. Business models: prices, paywalls, trials, lifetime and family plans, ads, B2B, insurers, coach marketplaces, and benchmark data

### Takeaway
The category's economics: health and fitness converts trials well (median about 38%) but **retains worst** (about 30% first-renewal). Hard paywalls convert about 5× better than freemium by day 35, with the **same year-one retention**. Annual plans dominate, and $35–100/yr is the band. Category revenue grew while downloads were flat (2025: $4.5B IAP, +13%; 3.96B installs, +0.8%), and AI apps earn more per payer but churn faster. B2B is moving from wellness perks toward clinical nutrition and GLP-1 programmes paid by employers and insurers.

### Cited Findings
**Benchmarks**
- RevenueCat 2026 (115k+ apps, $16B+ revenue): Health & Fitness median trial-to-paid **37.7%**, top quartile 51.4%, down from 39.9% in the 2025 report. Median download-to-trial 6.9%, download-to-paid within 35 days 2.9%, top quartile 6.2% (secondary extracts). — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025); [Sahha benchmarks](https://sahha.ai/blog/health-app-monetization-first-month/)
- Hard paywall vs freemium, all categories: 10.7% vs 2.1% download-to-paid by day 35. Year-one retention on annual plans about 27% vs 28%. — [BuildMVPFast summary](https://www.buildmvpfast.com/blog/hard-paywall-vs-free-trial-revenuecat-indie-app-2026); [SaaStr top 10 learnings](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Trials of 17–32 days convert at a 42.5% median vs 25.5% for trials under 4 days. — [RevenueCat blog: trial length](https://www.revenuecat.com/blog/growth/free-trial-length)
- Health & Fitness leads early monetisation with a median RPI of $0.48 at day 14 and $0.66 at day 60. AI-powered apps earn about 41% more revenue per payer over a year but **retain worse**. — [Mobile Marketing Reads](https://www.mobilemarketingreads.com/?p=50360); [SaaStr](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Renewal: RevenueCat's renewal table shows a Health & Fitness **median annual renewal of about 25%** (16% bottom quartile, 37% top quartile). This conflicts with an "86.4% yearly retention" figure elsewhere, which probably uses a different definition; **verify before citing**. Median annual price figures conflict ($24.23, $34.80, $35.64). — [RevenueCat renewal benchmarks](https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category)
- Adapty 2026: Health & Fitness trial-to-paid 35.0%, **first-renewal retention 30.3%, the lowest category** (Utilities 58.1%). Annual plans dominate. — [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions-2026)
- Sensor Tower (2025): Health & Fitness IAP revenue **$4.5B (+13%)**, installs 3.96B (+0.8%). The share of apps bidding on AI keywords rose from 19% to 28%, with Cal AI the heaviest. The US is over 50% of spend (2024) and the UK about 8%. — [Sensor Tower: State of Mobile Health & Fitness 2025](https://sensortower.com/blog/state-of-mobile-health-and-fitness-in-2025); [Sensor Tower: AI in H&F apps](https://sensortower.com/blog/health-and-fitness-apps-ai); [Mobile Marketing Reads](https://mobilemarketingreads.com/?p=50285)
- Average fitness-app day-30 retention is about 3–4% (vendor). — [Sahha churn article, 2026](https://sahha.ai/blog/health-app-churn-retention/)

**Price points (USD, 2026 unless noted)**
- MFP Premium $19.99/mo or $79.99/yr, Premium+ $24.99/mo or $99.99/yr. No sticker increase since Sep 2024. Barcode has been paywalled since 2022. — [subscription123 tracker](https://subscription123-1xk.pages.dev/price-hikes/myfitnesspal/); [FitBudd](https://www.fitbudd.com/post/myfitnesspal-app-cost)
- Google Health Premium $9.99/mo or $99/yr. Samsung Health is free. — see Q3
- Cronometer Gold about $59.99/yr, and Lose It! Premium "doubled to $79.99" in 2026. Both are single vendor-blog claims, **unverified**. — [NutriScan](https://nutriscan.app/vi/blog/posts/myfitnesspal-pricing-2026-guide-2ff09c399a)
- Meal planners cost $40–60/yr (Eat This Much, Mealime, Samsung Food+). See Q1.
- Lifetime deals appear in indie apps (Munch $34.99 lifetime), and Eat This Much has sold one-year deals through deal stores. — [Munch](https://apps.apple.com/app/id6757778600); [Entrepreneur store](https://store.entrepreneur.com/sales/eat-this-much-1-year-subscription)
- Noom GLP-1: $149 first month, then $279/mo (CNBC). — [CNBC](https://link.cnbc.com/view/5d7c88362c885e3b4657c808mwl1s.zk/2aa4c555)

**B2B, insurer and coach models**
- Discovery Vitality (South Africa) pays cash-back on healthy groceries and gates it on health assessments. It is the clearest insurer-funded nutrition-behaviour model. — [Discovery](https://www.discovery.co.za/vitality/vitality-benefit-updates-2)
- Employer-paid nutrition is moving clinical: Amazon Health Benefits Connector (Berry Street, Fay), Carrum + Virta (Mar 2026: nutrition + GLP-1 + bariatric for self-insured employers), Noom SmartRx. — [Pulse: Carrum/Virta](https://www.pulse.bot/healthtech/news/carrum-virta-join-forces-on-employer-weight-management-solution-e82ec845-c072-4a50-b8d5-280b83b1a4a8)
- Lifesum's corporate wellness distribution: YuLife marketplace (2023), Fiit partnership. MFP–Cigna coaching dates from about 10 years ago. — [Athletech: Lifesum corporate](https://athletechnews.com/lifesum-adds-big-name-corporate-wellness-partners/); [MobiHealthNews: Cigna MFP](https://www.mobihealthnews.com/news/cigna-integrates-myfitnesspal-coaching-program)
- Coach and pro tiers: Eat This Much Professional (per-client), HealthifyMe's human coaches + AI, Recovery Record for Clinicians. — [ProMealPlan](https://www.promealplan.com/en/blog/eat-this-much-review-2026); [Recovery Record for Clinicians](https://mwm.ai/apps/recovery-record-for-clinicians/657266479)

**Paywall backlash**
- Cal AI was pulled from the App Store in Apr 2026 over a deceptive paywall (earlier file). Noom's 2022 auto-renewal settlement still weighs on trust. MFP's reported May 2026 move of meal-scan and recipe import behind Premium is **unverified**. — [Yespress Noom summary](https://yespress.io/noom); [subscription123](https://subscription123-1xk.pages.dev/price-hikes/myfitnesspal/)

### Inferences
- With first-renewal retention at about 25–30%, the category's real problem is **year-two retention**, not conversion. Features that compound value over time (food memory, adaptive TDEE history, social graph, coach memory) fix exactly that, and they justify a freemium core over a hard paywall for an app that depends on network effects. A social app cannot hard-paywall the friend you invite.
- A defensible split: free = core logging, barcode, regional database and social, attacking MFP's barcode paywall. Paid = AI coach depth, adaptive targets, AI-logging volume, micronutrients and meal plans. Use a 2–4-week trial (longer trials convert better). Add a family or squad plan, which fits GRIT's social core; no competitor evidence of family plans was found.
- AI inference cost plus the "AI apps churn faster" finding argue for capping free AI logs and leaning on per-user memory to cut LLM calls.
- B2B and insurer routes are real but slow and clinical (GLP-1, nutrition therapy). A Vitality-style "verified healthy behaviour" data feed, from GRIT's logs, habits and challenges, is the natural asset to sell to insurers and employers, including in South Africa and Nigeria (HMOs).

### Gaps
- No primary RevenueCat 2026 Health & Fitness table was readable (fetch blocked). Price and retention figures conflict across secondary sources.
- No data on family-plan uptake or lifetime-deal economics in nutrition apps, and no data on ad revenue share for MFP or Lose It!.
- No emerging-market (Nigeria, India) conversion or ARPU benchmarks found.

## Q5. What users want from "one app for everything", what makes them churn, and how GRIT's nutrition side wins

### Takeaway
Users churn for three main reasons: they reach their goal, logging is a burden, and the app makes them feel ashamed or sets targets they can't hit. Platform all-in-ones answer burden with AI but are shallow on nutrition, tied to hardware, and paywalled. For GRIT to be best on nutrition, it needs the most accurate logging for the user's own foods, including West African dishes, at near-zero effort, plus targets that adapt kindly, wrapped in social accountability and a coach that remembers. No 2026 competitor combines all of these.

### Cited Findings
- Churn drivers (eMarketer, Jan 2026): users quit when they **reach the goal** (weight-loss apps get dropped instead of becoming lifestyle tools) and from the **stress of constant tracking**. — [eMarketer](https://www.emarketer.com/content/ai-will-power-next-phase-of-health-app-growth)
- Shame, nagging notifications and unreachable algorithm-set targets are the main negative themes (BJHP, 2025). — [EurekAlert](https://www.eurekalert.org/news-releases/1102616)
- JMIR 2024 scoping review: 22 reasons for abandoning lifestyle and mental-health apps, in 6 categories led by technical and functional problems. — [JMIR 2024 e56897](https://www.jmir.org/2024//e56897)
- Survival analysis of 3,034 fitness-app users (mHealth, Oct 2025) models dropout drivers. — [mHealth](https://mhealth.amegroups.org/article/view/144969/html)
- Wearable owners want native nutrition in the same app, and the integration they have is "only decent". — [WHOOP community](https://www.community.whoop.com/t/product-suggestion-native-ai-nutrition-tracking-inside-whoop/14901)
- Fitbit preview users asked for photo food logging inside the coach. — [Fitbit community](https://community.fitbit.com/t5/Personal-Health-Coach-Public-Preview/Feature-Suggestion-AI-Photo-Food-Logging/td-p/5827656)
- Regional apps that won did so with local food data and language (HealthifyMe, Fitia). — see Q2

### Inferences
**What would make GRIT's nutrition clearly best (ranked by evidence):**
1. **Accuracy you can see.** Database-grounded AI with confidence badges and an explicit fat and oil check, because AI errors cluster in fat and protein. Publish a small validation of GRIT's estimates, especially on Nigerian dishes. No platform publishes accuracy data.
2. **The best West African food layer.** WAFCT 2019 + Nigeria NCT + USDA/OFF, dish-level recipes, Yoruba/Igbo/Hausa/Pidgin names, local portion units, and label-photo contributions with moderation. Incumbents have no incentive to build this, and HealthifyMe and Fitia show it can carry a business.
3. **Memory-first logging.** Per-user food memory and "my usual" cut the logging burden, the main churn driver, and reduce LLM cost.
4. **Kind adaptive targets.** MacroFactor-style adaptation with caps, a "maintenance after goal" mode (so reaching the goal doesn't mean leaving), and non-shaming copy.
5. **Safety and non-diet modes.** Hide-numbers mode, quality scores (protein, fibre, plants, ultra-processed share), ED screening with a soft off-ramp, and age gating. This reaches the intuitive-eating segment and meets 2025–26 research concerns.
6. **Micronutrients by estimation,** grounded in WAFCT nutrient fields; Cronometer is still the only one known for this.
7. **Coach-generated meal plans and grocery lists from the user's own foods,** with an auto-fill diary. Bolt-on planners cost $40–60/yr separately.

**How the all-in-one wins:** be cross-platform (iOS and Android, both health stores) where Google and Samsung are OS- or hardware-locked. Be **social** where none of the platforms are. Be deep in nutrition where the platforms are shallow. Keep the core free where MFP paywalls barcode. Monetise depth (coach, AI volume, micros, plans) and squad or family plans, and later sell verified-behaviour data to insurers and employers (Vitality model). In Nigeria: Android-first, naira pricing, Paystack web checkout, low-data mode.

### Gaps
- No 2025–26 survey specifically on what users want from an all-in-one versus single-purpose apps, or on all-in-one-specific churn.
- No readable 2026 Reddit threads (r/loseit, r/MacroFactor, r/Myfitnesspal) in this session. User sentiment comes from forum and community posts and the studies above.
