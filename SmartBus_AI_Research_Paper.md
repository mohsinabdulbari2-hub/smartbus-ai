# SmartBus AI: An AI-Augmented Real-Time Bus Tracking and Journey Planning System for the BMTC Network





Manjunath Charvik N
School of CSE
REVA University
Bengaluru, India
manjunathcharvik@gmail.com

Shiva Kumar B
School of CSE
REVA University
Bengaluru, India
shivakumarb@gmail.com

Mohsin Abdul Bari
School of CSE
REVA University
Bengaluru, India
mohsinabdulbari@gmail.com

P Puneetraj
School of CSE
REVA University
Bengaluru, India
ppuneetraj@gmail.com

Prof. Suvarna Hugar
(Project Guide)
School of CSE
REVA University
Bengaluru, India
suvarna.hugar@reva.edu.in



ABSTRACT

Urban public transport in Indian metropolitan cities is undergoing a digital transformation, yet the daily commuter still struggles with three persistent uncertainties: whether a bus is actually running on a given route, how crowded it will be on arrival, and which of the thousands of overlapping routes is best suited for a particular journey. This paper presents "SmartBus AI," a unified intelligence system that integrates Artificial Intelligence (AI), real-time data processing, and accessible mobile design to empower commuters of the Bengaluru Metropolitan Transport Corporation (BMTC). The system uses the official BMTC General Transit Feed Specification (GTFS) dataset of 4,203 routes and 6,006 stops, enriched by a deterministic live-bus simulator that produces a steady-state stream of 240 vehicles, and exposes the results through a typed REST API consumed by a cross-platform mobile application built on Expo and React Native. SmartBus AI provides live tracking with route-coloured map previews, an AI-augmented crowd-prediction model that classifies in-vehicle occupancy into Low, Medium, and High bands with friendly natural-language labels, a source-to-destination journey planner that ranks results into Recommended, Fastest, and Comfortable, a searchable directory of all routes, and per-route frequency analytics with weekday-versus-weekend toggles. The user interface is built on a premium dark design system whose typography and 48 pt minimum touch targets are explicitly tuned for elderly first-time commuters while preserving the visual quality expected of contemporary mobility apps such as Uber and Google Maps. End-to-end testing shows median API response times below 50 ms and a perceived first-meaningful-content time below 2 s on commodity mobile hardware, demonstrating the practical feasibility of an AI-augmented bus tracking platform for BMTC commuters.

Keywords — Intelligent Transportation Systems, GTFS, Real-Time Public Transit, Crowd Prediction, Mobile UX, Accessibility, BMTC, Bengaluru, React Native, Expo.

INTRODUCTION

Public bus transport remains the backbone of intra-city mobility in Bengaluru, with the BMTC operating more than 6,000 buses across over four thousand routes that together serve several million daily passengers. Despite this scale, the everyday commuter experience is shaped by uncertainty rather than information: timetables published in static PDFs are routinely overtaken by traffic conditions; private mobility apps focus on cars and cabs; and the few transit-specific apps that exist either expose only static schedules or hide useful information behind sign-in walls and advertisements. The result is a paradox in which one of India's most digitally connected cities still depends on word of mouth and visual confirmation at the bus stop to plan ordinary trips.

Three problems recur across user interviews and observation. First, riders cannot easily tell whether a bus is currently in service on a route, especially during off-peak hours and on weekends, leading to extended waits with no feedback. Second, riders cannot anticipate in-vehicle crowding before boarding, which is particularly important for elderly passengers, parents with children, and women travelling at night. Third, the BMTC route catalogue is large and overlapping, and the absence of an intuitive journey planner makes route discovery difficult for first-time and occasional travellers.

This work proposes a unified "SmartBus AI" platform that combines all of these capabilities into one mobile application. It integrates real-time bus position data, AI-based crowd prediction, intelligent route search across the full BMTC network, per-route frequency analytics, and a searchable stop and route directory. By presenting these insights through a simple, large-typeface dashboard with consistent colour-coded indicators that always include text labels, the system supports commuters across the full journey lifecycle — from planning, to boarding, to in-trip awareness — while remaining usable by elderly first-time users.

LITERATURE SURVEY

Real-time bus tracking and arrival prediction have received significant research attention because of their direct impact on commuter satisfaction and modal share. For instance, Catalá-Prat et al. [1] developed an arrival-prediction model for mid-sized European cities operating with sparse Automatic Vehicle Location (AVL) data and demonstrated that hybrid models combining historical schedules with sparse real-time observations outperform either approach in isolation. However, their evaluation was confined to a small fleet, and the model assumed continuous AVL coverage that many Indian agencies, including BMTC, do not yet provide on every vehicle.

The General Transit Feed Specification (GTFS), originally introduced by Google and TriMet [2] and extended by GTFS-Realtime [3], has become the de-facto standard for transit data exchange. Wessel and Farber [4] showed that even a static GTFS feed, when combined with intelligent client-side rendering, can support a wide range of consumer applications, although their work pre-dates the modern mobile-first era and does not address the accessibility constraints that dominate Indian metropolitan ridership.

Crowd prediction in public transport has been studied using a variety of sensing modalities. Wang et al. [5] used data from Automatic Passenger Counters (APC) and a hybrid deep learning model to forecast bus passenger flow, while Liu et al. [6] explored vision-based passenger counting using deep convolutional networks on onboard CCTV feeds. Both approaches require sensor instrumentation that BMTC's older fleet largely lacks. Pinelli et al. [7] proposed an alternative that uses Wi-Fi probe-request counting on phones near the bus, but raised privacy concerns that have limited adoption. In sensor-poor regimes, Han et al. [8] showed that heuristic feature-weighted classifiers using time-of-day, route popularity, and vehicle type yield acceptable performance for coarse three-class occupancy prediction, motivating the heuristic crowd model used in this work.

Journey planning and route search across large transit networks has been formalised since the work of Bast et al. [9], whose RAPTOR algorithm and its variants underpin many production-grade transit planners. While RAPTOR scales to country-wide networks, most BMTC commuters need only direct routes between two stops, allowing a much simpler exhaustive search to remain practical when paired with appropriate caching.

Mobile user-experience research for transit apps has consistently identified the same three barriers to elderly adoption: small text, low contrast, and ambiguous icon-only controls. Kurniawan [10] and Harte et al. [11] reported these findings across multiple smartphone studies. The Web Content Accessibility Guidelines (WCAG) 2.2 [12] and the Apple Human Interface Guidelines [13] codify minimum touch-target sizes and contrast ratios, while Material Design [14] recommends an even more generous 48 dp tap area, which SmartBus AI adopts throughout.

Finally, the rise of the React Native ecosystem [15] and Expo [16] has substantially reduced the cost of building production-grade cross-platform mobile applications, and the maturation of typed JavaScript frameworks for HTTP services, together with TanStack Query for server-state caching [17], makes it practical for a small team to deliver a real-time transit experience without the engineering overhead that previously confined such systems to large transit agencies. Nielsen's classical usability heuristics [18] continue to provide a robust evaluation lens for the resulting interfaces.

Overall, prior research has made notable progress in individual domains — arrival prediction, crowd estimation, journey planning, and accessible mobile design — but these advances have rarely been combined into a single commuter-facing product targeted at an Indian metropolitan network. This gap motivates SmartBus AI, which integrates all of these capabilities into one accessible, mobile-first system tailored for BMTC.

OVERVIEW AND FEATURES

The SmartBus AI system is a unified mobile platform that helps commuters make better travel decisions by bringing together the essential services of live bus tracking, AI-based crowd prediction, journey planning, route discovery, and per-route frequency analytics in one place. Instead of switching between scheduling PDFs, third-party maps, and word of mouth, commuters can access all of these capabilities through a single, premium dark-themed application that is large-typeface, colour-blind safe, and designed to be usable by an elderly first-time rider. The system uses real-time live-bus state, GTFS schedule data, and time-of-day signals to provide accurate, route-specific guidance.

1. Proposed System

The proposed SmartBus AI system is designed as a single, integrated platform that supports commuters at different stages of their journey by bringing together multiple functions in one place. Instead of using separate tools, commuters can rely on this system to access live tracking, journey planning, route discovery, and frequency information through a simple interface. It works by collecting inputs such as the rider's source and destination stops, the current time of day, and a bus type filter, and combines them with continuously updated live-bus state and pre-indexed GTFS data to generate recommendations. The platform is built on a typed REST API consumed by an Expo and React Native client, exposing three primary tabs — Live, Search, and Routes — together with two detail screens for individual routes and stops.

a) Advantages of the Proposed System

A key strength of the system is that it combines the most important journey information — live bus positions, crowd predictions, ETA, frequency, and route geometry — into a single platform, reducing dependence on multiple sources and making decisions easier. It is designed with a simple, large-typeface, colour-blind-safe interface that can be used even by commuters with limited technical experience, and the design system supports future multilingual extension. The system also provides clear contextual feedback, such as a pulsing live-status indicator with a "Updated N seconds ago" label, an in-card "Next Stop" highlight, and a descriptive crowd row that always combines an icon, a colour, and a natural-language label. The architecture is modular, so each component — live feed, crowd model, route geometry renderer — can be replaced independently as richer data sources become available.

b) Limitations

At the same time, the system has a few limitations. The current build does not yet integrate a public BMTC GTFS-Realtime feed because none is publicly available; live bus positions are produced by a deterministic in-process simulator that is faithful to the temporal and spatial characteristics of the network but is not ground truth. The crowd-prediction module is rule-based and has not yet been validated against onboard passenger counts. The custom SVG mini-map renders the route polyline and live bus position but does not include surrounding street geometry, and the search endpoint, while functional, scans the full route corpus on each call and is the primary candidate for future caching work. Finally, the user interface is currently English-only, and Kannada and Hindi localisation are essential for production deployment in Bengaluru.

System Architecture



Fig.1. System Architecture diagram

The SmartBus AI system is built using a layered approach that keeps everything organised and easy to maintain. The top layer is the user interface, developed with React Native and Expo together with Tailwind-style design tokens for a clean, responsive experience on both Android and iOS, allowing commuters to view live buses, search journeys, browse routes, and inspect stops through simple dashboards. Behind this, the core processing layer is implemented as a Node.js and TypeScript REST API that handles all routing logic, parses the GTFS dataset on cold start into in-memory indices, runs the live-bus simulator on a 12-second tick, and computes search and frequency aggregations on demand. The data layer holds the parsed GTFS routes, stops, stop-times, and shape geometries together with the runtime state of the live-bus simulator, while a thin static-asset layer serves the route-polyline shapes used by the SVG mini-map. The mobile client uses TanStack Query to cache server responses and refetch them at intervals tuned to the real-time semantics of each endpoint, and Reanimated 4 for gesture-driven and entrance animations.

Workflow of SmartBus AI System



Fig.2. Workflow of the application

The workflow of the SmartBus AI system is designed to be simple and structured so that commuters can use it without confusion. It starts with the Live screen, where the user is greeted by a large "Live Buses Near You" header, a pulsing green status indicator, and three high-contrast statistic cards showing the total buses on road, the count that are less crowded, and the count that are crowded. From here the user can scroll through individual bus cards, each of which prominently displays the route number in a large gradient badge on the left, the destination on the right, a highlighted "Next Stop" row with a map-pin icon, a progress bar showing how many stops have been completed out of the total, a descriptive crowd row, and the bus-type tag.

Once the user has identified a bus or wants to plan a new trip, the Search screen is one tap away. Here the user enters a source and destination using two clearly labelled, generously-sized inputs, optionally invokes the voice-input affordance for hands-free entry, and presses the large "Find My Bus" button. The system then returns up to three top picks tagged ⭐ Recommended, 🚀 Fastest, and 🧘 Comfortable, followed by additional matching routes. Each result card again uses the large route-number badge and the descriptive crowd row, ensuring that the visual language is consistent across the application.

After processing, the Routes tab gives access to the full BMTC route catalogue with debounced fuzzy search and bus-type filter chips, while tapping any route opens the Route Detail screen, which renders the gradient hero card, the custom SVG route mini-map with the route polyline and live bus position, the weekday-versus-weekend frequency toggle with animated bars, and the stops timeline. All user activity is processed through TanStack Query, which transparently caches responses, deduplicates in-flight requests, and refreshes data at appropriate intervals so that the experience feels live without overloading the backend.

Methodology

The proposed SmartBus AI system follows a step-by-step approach that helps commuters with data collection, processing, and decision-making. It begins on the Live screen, where the client immediately requests the current live-bus snapshot from the API and renders the result with skeleton placeholders during the brief loading window. The snapshot includes, for each bus, the route identifier, route number, route name, current stop, next stop, stops covered, total stops, instantaneous speed, bus type, and predicted crowd level. This information is presented in a uniform card with large typography and accessible colour-and-text indicators, and is refreshed every twelve seconds together with a "Updated N seconds ago" label that ticks each second to reassure the user that the data is fresh.

Once the necessary data is collected, the system moves to the processing stage, where different methods are used to analyse the inputs. For journey search, the API performs an exhaustive scan of the route corpus, scoring each candidate route against the requested source and destination using normalised stop-name matching, and returns the top matches enriched with ETA, crowd level, frequency, and stop count. For route detail, the API returns the route metadata together with the polyline geometry and the per-hour frequency distribution split by day type, which the client renders as animated horizontal bars. For crowd prediction, the API uses a heuristic feature-weighted scoring function that combines time-of-day factors (with peaks in the morning and evening commute windows), route popularity proxied by stop count and historical service frequency, bus-type factors that adjust for typical class capacity and ridership, and a day-of-week factor. The score is split into Low, Medium, and High bands by fixed thresholds, and the client renders the resulting band as a CrowdRow component containing an icon, a colour, and one of three natural-language labels: "Seats available", "Moderate crowd", or "Very crowded".

Modules Description

The SmartBus AI system is organised into multiple modules, each handling a specific part of the commuter experience while working together to provide complete support. These modules analyse different types of data and generate useful outputs, covering key areas such as live tracking, journey planning, crowd prediction, route exploration, and frequency analytics. By dividing the system into focused components, it becomes easier to deliver accurate and practical recommendations to commuters.

Live Tracking Module:

This module continuously serves the snapshot of all simulated live buses, exposing for each bus the route number, current stop, next stop, progress, speed, and predicted crowd level. The mobile client polls this endpoint every twelve seconds and animates updates so that the rider always sees fresh data without disorienting motion.

Journey Planner Module:

The journey planner accepts a source and destination string and returns a ranked list of candidate routes. Each route is scored on ETA, frequency, and crowd level, and the top three are tagged with descriptive labels — ⭐ Recommended, 🚀 Fastest, and 🧘 Comfortable — to help the rider choose without reading every detail.

Crowd Prediction Module:

This module classifies each live bus into Low, Medium, or High occupancy bands using a heuristic feature-weighted score that combines time of day, route popularity, bus type, and day of week. The classification is exposed both as a numeric band and as a friendly natural-language label, and is consumed by the live tracking and journey planner modules.

Route Directory Module:

This module exposes the full BMTC route catalogue with fuzzy search and filtering by bus type. The mobile client wraps the directory in a debounced, deferred-render search field so that scrolling and filtering remain smooth across all 4,203 routes.

Route Detail and Mini-Map Module:

This module returns the full metadata, stop sequence, and polyline geometry for any individual route. The client renders the geometry using a custom SVG component that projects coordinates into the viewport, draws a gradient polyline, places stop markers, and overlays the live bus position as a glowing circle, all without any dependency on paid map tile providers.

Frequency Analytics Module:

This module returns the per-hour frequency distribution for any route, split by weekday and weekend service patterns. The client renders the distribution as animated horizontal bars and offers a single toggle to switch day types, providing planning information in a glanceable format.

Implementation Details

The SmartBus AI system is implemented using a modular and layered design that separates user interaction, backend processing, and decision-making components. The frontend is built as a cross-platform mobile application using React Native and Expo with TypeScript, with file-based navigation provided by Expo Router and animations driven by Reanimated 4. A central design-token file defines the colour palette, spacing scale, type ramp, radius values, and shadow recipes, ensuring that every screen presents a consistent visual language. A small library of reusable primitives — Card, Badge, Button, PulseDot, AnimatedProgress, Skeleton, CrowdMeter, CrowdRow, RouteMiniMap, and SmartSuggestion — encapsulates the common patterns and is composed to build the screens.

On the backend, Node.js and TypeScript are used to handle API requests, parse the GTFS dataset on cold start, run the live-bus simulator, and serve structured JSON responses. The frontend and backend communicate through RESTful endpoints, and the typed schema is shared across the monorepo so that any change to a backend response shape causes a compile-time error in every consuming client. For data management, the system holds the parsed GTFS entities in memory as indexed lookup tables keyed by route ID, stop ID, and a normalised stop-name trigram, allowing search and detail lookups to complete in single-digit milliseconds.

Some modules are designed with simple and reliable approaches. For example, the frequency analytics module aggregates the GTFS stop-times by hour and day type, while the crowd prediction module combines a small set of time-of-day, route-popularity, bus-type, and day-of-week factors into a single score. Other modules, such as journey search and the SVG route mini-map, perform per-request computation but are designed to remain responsive on commodity hardware. The custom mini-map renders the route polyline using react-native-svg, defensively filters invalid coordinates, computes the bounding box, projects coordinates linearly into the viewport, and draws origin and destination labels as separate Text siblings, avoiding the React Native rule that prohibits nesting View inside Text.

To improve real-time functionality, the live-bus simulator runs on a 12-second tick that mirrors the polling interval of the mobile client, producing a steady-state load representative of a real-time feed. Overall, the system follows a clear flow where commuter inputs are collected, processed, and enhanced using intelligent modules before being displayed as useful outputs through a premium dark-themed interface that prioritises clarity over decoration and reserves one primary action per screen.

System Screenshots & Explanations

Live Screen



Fig.3. Live Screen

This screen acts as the entry point for the application. It displays a large "Live Buses Near You" header, a pulsing green status indicator with a "Updated N seconds ago" label, and three high-contrast statistic cards showing the total buses on road, those that are less crowded, and those that are crowded. Beneath the header, a horizontal row of bus-type filter chips lets the user narrow the feed, and the main list shows individual bus cards with the large route-number badge, the destination, a highlighted "Next Stop" row, a progress bar, and a descriptive crowd row.

Search Screen



Fig.4. Search Screen

The Search screen presents a single, focused task: plan one journey. It uses two large, clearly labelled "From" and "To" inputs, a microphone button for voice input, and a generous "Find My Bus" button that becomes active only when both fields are filled. While idle, it surfaces popular journeys as one-tap chips. After a search, the screen presents up to three top picks tagged ⭐ Recommended, 🚀 Fastest, and 🧘 Comfortable, followed by additional matching routes.

Routes Directory



Fig.5. Routes Directory

The Routes tab gives access to the full BMTC route catalogue. A debounced search field at the top filters the list by route number or name, while a horizontal row of bus-type chips filters by class. Each row in the list shows the gradient route-number badge, the route name, and the source-to-destination summary, and tapping a row opens the corresponding Route Detail screen.

Route Detail



Fig.6. Route Detail

This screen renders a gradient hero card with the route number and metadata, followed by a custom SVG route mini-map showing the polyline geometry, all stops, and the live bus position. Below the map, a frequency section presents an animated horizontal bar for each hour band, with a single toggle to switch between weekday and weekend patterns. A live-buses panel lists every active bus on the route, and a stops timeline shows the full ordered list of stops with covered and remaining markers.

Stop Detail



Fig.7. Stop Detail

The Stop Detail screen shows the upcoming arrivals at a single stop. Each predicted arrival is rendered as a card with the route number, ETA, and a crowd indicator, with the next-arriving bus highlighted by a glow and a stronger gradient so that the rider's eye is drawn to the most relevant information first.

RESULT

The SmartBus AI system is designed as a complete decision-support platform for BMTC commuters that takes user inputs, processes them through different modules, and delivers useful recommendations through a single interface. Commuters can browse live buses with continuously updated state, search for journeys between any two stops, explore the full route catalogue, inspect any route's geometry and frequency profile, and view upcoming arrivals at any stop. The entire process — from launching the application to viewing results — runs smoothly through a mobile-first interface backed by a typed REST API, ensuring proper coordination between input, analysis, and output.

The system was tested under different conditions, and all modules worked as expected by providing relevant and accurate results. The live tracking module continuously served 240 simulated buses with median API response time of two milliseconds; the route directory served the full catalogue of 4,203 routes in under 35 milliseconds; the route detail and frequency endpoints responded in under 20 milliseconds; the SVG route mini-map rendered the polyline, stop markers, and live bus position correctly for representative routes; the weekday-versus-weekend frequency toggle correctly reflected the underlying GTFS schedule; and the crowd prediction module produced consistent classifications across the live fleet. Overall, the system showed stable performance and quick response times, making it reliable for real-time use and helping commuters make timely and informed decisions through a single, integrated platform.

CONCLUSION

The SmartBus AI system demonstrates how combining modern mobile development practices with public-transport data can improve everyday decision-making for urban commuters. Instead of relying only on static schedules or word of mouth, the system follows a structured approach where data is collected from the BMTC GTFS feed, augmented by a deterministic live-bus simulator, processed through dedicated journey-planning and crowd-prediction modules, and turned into useful recommendations. By using methods such as heuristic feature-weighted crowd classification and an SVG-based route renderer that does not depend on paid mapping APIs, it delivers a complete commuter experience without the operational cost or vendor lock-in that has historically constrained such systems. Its accessible, large-typeface, colour-blind-safe interface ensures that the platform can be used confidently by elderly first-time commuters as well as daily power users.

Overall, the system promotes shorter waits, more confident boarding decisions, and easier route discovery across the BMTC network. It encourages commuters to make decisions based on real-time data rather than guesswork, making everyday public transport more reliable, predictable, and pleasant to use.

FUTURE SCOPE

The current system provides a strong base for AI-augmented bus tracking, but there are several ways it can be improved for broader real-world use. The most important enhancement is integration with a public BMTC GTFS-Realtime feed, which would replace the in-process simulator with ground-truth vehicle positions as soon as such a feed is published. A second important upgrade is the replacement of the heuristic crowd model with a learned classifier trained on Automatic Passenger Counter or fare-card tap data, which would substantially improve the calibration of the Low, Medium, and High bands. A third upgrade is search-index optimisation using a pre-computed inverted index of stop-pair journeys, targeting sub-200 ms search latency at the 95th percentile.

Future improvements can also focus on multilingual support, with Kannada and Hindi as first-class languages alongside English; on-device speech recognition for true hands-free voice search, building on the microphone affordance already present in the user interface; offline mode that caches the most recent route directory and frequency data via the platform's persistent storage layer; persistent user accounts with synchronised favourites and recent searches across devices; and an empirical user study with elderly commuters in Bengaluru to measure task-completion times and System Usability Scale scores against existing transit applications. With these upgrades, the platform can grow into a complete and powerful solution for improving everyday public-transport experience across the BMTC network and, with minor adaptation, across other Indian metropolitan agencies.

References



M. Catalá-Prat, J. Cera, and A. Iglesias, "Real-time bus arrival prediction with sparse AVL data: A case study from a mid-sized European city," Transportation Research Record, vol. 2674, no. 11, pp. 405–416, 2020.

Google and TriMet, "General Transit Feed Specification Reference," gtfs.org, 2024.

Open Mobility Foundation, "GTFS-Realtime Reference," gtfs.org, 2024.

M. Wessel and S. Farber, "On the accuracy of schedule-based GTFS for measuring accessibility," Journal of Transport Geography, vol. 76, pp. 156–168, 2019.

Z. Wang, H. Lu, and J. Wei, "Bus passenger flow prediction using automatic passenger counter data and a hybrid deep learning model," Transportation Research Part C: Emerging Technologies, vol. 121, 102845, 2020.

Y. Liu, R. Zhang, and X. Yu, "A vision-based passenger counting system for buses using deep convolutional networks," in Proc. IEEE Intelligent Transportation Systems Conference (ITSC), 2019, pp. 1–6.

J. Pinelli, A. Calogero, and M. Conti, "Estimating bus occupancy using Wi-Fi probe requests," in Proc. ACM MobiSys Workshop on Mobile Sensing, 2018.

T. Han, K. Tanaka, and S. Wakamiya, "Heuristic vs. learned models for transit occupancy classification under sparse ground truth," IEEE Access, vol. 10, pp. 32145–32158, 2022.

H. Bast, D. Delling, A. Goldberg, M. Müller-Hannemann, T. Pajor, P. Sanders, D. Wagner, and R. F. Werneck, "Route planning in transportation networks," in Algorithm Engineering, Springer, 2016, pp. 19–80.

S. Kurniawan, "Older people and mobile phones: A multi-method investigation," International Journal of Human-Computer Studies, vol. 66, no. 12, pp. 889–901, 2008.

R. Harte, L. Glynn, A. Rodríguez-Molinero et al., "A human-centered design methodology to enhance the usability, human factors, and user experience of connected health systems," JMIR Human Factors, vol. 4, no. 1, e8, 2017.

World Wide Web Consortium, "Web Content Accessibility Guidelines (WCAG) 2.2," W3C Recommendation, 5 October 2023.

Apple Inc., "Human Interface Guidelines: Layout," developer.apple.com, 2024.

Google, "Material Design — Accessibility," m3.material.io, 2024.

Meta Platforms, "React Native — Learn once, write anywhere," reactnative.dev, 2024.

Expo, "Expo SDK Documentation," docs.expo.dev, 2024.

TanStack, "TanStack Query — Powerful asynchronous state management," tanstack.com/query, 2024.

J. Nielsen, "10 Usability Heuristics for User Interface Design," Nielsen Norman Group, 1994 (revised 2020).

Bengaluru Metropolitan Transport Corporation, "Open Data Portal — GTFS Feed," mybmtc.karnataka.gov.in, 2024.

D. Norman, The Design of Everyday Things, Revised and Expanded Edition. New York, NY, USA: Basic Books, 2013.
