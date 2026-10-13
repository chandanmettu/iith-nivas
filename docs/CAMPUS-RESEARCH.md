# IITH whole-campus 3D model: data availability research

Background for [CAMPUS-PLAN.md](CAMPUS-PLAN.md). Gathered by a research agent on 2026-10-13; the hostel-list discrepancy in section 3.5 was re-checked by hand against https://hostel.iith.ac.in/ the same day. Treat anything marked UNVERIFIED as a lead, not a fact.

Researched 2026-10-13. Purpose: facts for a PLAN (no build). Every claim has a source URL. Anything I could not verify is marked UNVERIFIED. "Measured" means I got the number myself from a live query; "Derived" means I computed it from measured data; "Estimate" means extrapolation.

The raw Overpass answers are not kept in the repo (they are OpenStreetMap data; see the licence notes below). The queries are listed in the appendix and can be re-run.

---------------------------------------------------------------------------

## 0. Headline findings

1. OSM has a real IITH campus boundary and 58 mapped buildings inside it, 53 of them named. That is a usable skeleton, not a complete campus. 20 of the 23 official hostel blocks are mapped (by name or by block letter); 3 are not identifiable. There are no height tags at all, `building:levels` on 21 of 58, and no trees, water, landuse or colour/material tags. Roads and footpaths are well mapped (187 highway ways). Pitches are mapped (football, hockey, tennis, basketball, volleyball, badminton, table tennis, athletics track) but not cricket.
2. The "two clusters" claim in the old prototype is SUPPORTED by OSM and by IITH's own documents, not contradicted. OSM shows eight identical new 10-level blocks about 350 m north-west of the "Hostel Circle Bus Stop" and the older block group (A to J) right at and east of it. IITH's Welcome Booklet 2022 names "Hostel Circle" and "New Hostels" as separate places linked by shuttles. IITH's RTI contract list says "Boys Hostel (8 Nos)" in Package 3B.
3. The eight new blocks have the SAME footprint in OSM (840 m2, 28 vertices, about 52.5 x 27.2 m). That is the one place where InstancedMesh is a genuine fit.
4. OSM data is ODbL. A baked JSON of footprints that we host publicly should be treated as a Derivative Database: ODbL, attribution, and an offer of the data. It cannot sit under the repo's MIT licence. Alternatives with simpler terms exist for footprints (Microsoft CDLA-Permissive-2.0, Google Open Buildings CC BY 4.0) but have no names or heights.
5. Discrepancies worth settling before any build: (a) the official hostel page lists Aryabhatta and Bhaskara as GIRLS blocks, while the Nivas list has them as boys' hostels; (b) OSM tags Varahamihira as 6 levels with a different footprint than the new 10-level type, while Nivas models Varahamihira as ten floors; (c) Wikipedia credits hostels to Christopher Benninger, which his own firm's page contradicts.

---------------------------------------------------------------------------

## 1. OpenStreetMap coverage of IITH (Overpass, measured 2026-10-13)

### 1.1 How I queried

Public Overpass API at https://overpass-api.de/api/interpreter (usage policy: https://wiki.openstreetmap.org/wiki/Overpass_API). I sent a User-Agent naming this research. Snapshot timestamp returned by the server: 2026-10-13T17:50:47Z.

Honest query count: 6 data queries succeeded, but the server answered "probably too busy" (a timeout error) on 5 other attempts, and one tiny CORS probe returned HTTP 504. So 12 data requests in about 10 minutes, 6 succeeded. Plus 3 single-object calls to https://api.openstreetmap.org/api/0.6/ (a bus-stop node and 3 ways) for timestamps. Everything was counts, tags and 58 small footprints. No bulk download.

### 1.2 Campus boundary

- OSM way 305851274, `amenity=university`, `barrier=wall`, name "Indian Institute of Technology Hyderabad", `wikidata=Q2808676`, `note=It is a permanent Campus under construction`. Source: https://www.openstreetmap.org/way/305851274 (queried via Overpass).
- Its bounding box (measured): lat 17.5795338 to 17.6050608, lon 78.1156702 to 78.1317644. That is about 2.83 km north-south by 1.71 km east-west (derived). ARCOP's own slides quote "2.8 KM" and "1.7 KM" for the site (https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf, slide 5), so the OSM polygon matches the design site.
- Centre of the polygon: about 17.5923 N, 78.1237 E. My starting guess of "17.59 N, 78.12 E" was right to two decimals; the campus centre is nearer 78.124 E.
- Campus area, from sources (they disagree): 576 acres (234 ha) per Wikipedia https://en.wikipedia.org/wiki/IIT_Hyderabad ; "~600 acres" per IITH newsletter https://pr.iith.ac.in/newsletter/download/17/KID_20230401.pdf ; "more than 600 acres" per https://iith.ac.in/assets/files/pdf/welcome_Booklet_2022.pdf ; "approximately 2 km2" per JICA https://openjicareport.jica.go.jp/pdf/12182440_01.pdf ; "500 acres" per CCBA https://www.ccba.in/project/department-of-physics,-mathematics-&-liberal-arts-(ad-3),-iit-h .

### 1.3 Counts inside the boundary polygon (measured)

| What | Count | Notes |
|---|---|---|
| `building=*` ways | 58 | 0 relations, so no multipolygon buildings, no holes |
| ... with a `name` | 53 | 5 unnamed (2 odd 65-vertex shapes near the Nescafe cafe, 2 small `tourism=apartment`, 1 unlabelled) |
| ... with `building:levels` | 21 | |
| ... with `height` | 0 | none at all |
| ... with `building:colour`, `building:material` or `roof:shape` | 0 | no facade or roof data |
| `building` in {dormitory, residential, apartments, house, university, college, hostel} | 33 | `college` is the commonest value, used for all 8 new hostels |
| `building=dormitory` | 3 | Kautilya Block, Varahamihra Hostel, "RECREATION ROOM" |
| `building=yes` | 24 | includes most old hostels |
| `highway=*` ways | 187 | 82 footway/path/pedestrian/steps/cycleway/track; 105 service/residential/unclassified/tertiary etc. (19 of these are "TiHAN") |
| `natural=tree` nodes, `tree_row` | 0, 0 | no trees mapped |
| `natural`, `waterway`, `water` | 0 | no water, no scrub, no wood |
| `landuse` | 0 | no grass, no forest, no education landuse |
| `leisure` ways | 11 | 7 pitches, 2 fitness centres, 1 athletics track, 1 sports centre |
| swimming pool | 0 | the new Sports and Cultural Complex has one per IITH, but it is not mapped |
| Buildings outside the wall in a 5.5 x 5.5 km box (17.570-17.620 N, 78.100-78.150 E) | 59 | the surrounding villages, not campus |

Pitches and sports mapped (measured): FOOTBALL GROUND (way 742763408), HOCKEY GROUND (742763409), TABLE TENNN [sic] (742764809), Badminton/TT/Squash Court (1214028279), Lawn Tennis Court (1214028280), Volleyball Court (1214028281), Basketball Court (1214028282), "Athletic Track, SNCC" (1242150845, `leisure=track`, `sport=running`), "Sports and Cultural Complex" (1242150847, `leisure=sports_centre`, no `building` tag), "Open Amphitheatre, SNCC" (1242150846). No `sport=cricket`. IITH says it has cricket grounds (https://iith.ac.in/assets/files/pdf/welcome_Booklet_2022.pdf, "ABOUT THE CAMPUS"), so cricket is a mapping gap.

Named roads (measured): "Main Road IITH" / "Main road IITH" (`highway=service`, `access=private`, `oneway=yes`, `lanes=2`), "IIT H Hospital Road", "Main Gate - Hostel Road", "Road to RCC", "Faculty Tower Service Road", and many footpaths ("Acad - Hostel Circle Foot Path", "Hostel Circle - Old Hostel", "New Mess - Acads Pedestrian Bridge", "Outer Ring Footpath" and so on). Main gate: gate ways 898487053 / 898487054 near 17.5800 N, 78.1207-78.1215 E.

### 1.4 Hostels: can they be told apart? Mostly yes, with traps

Hostel buildings in OSM, with OSM way ID, tags and measured footprint (areas derived from the geometry):

Old cluster, east side (centre lon about 78.1255 to 78.1271):

| OSM name | way ID | levels | vertices | footprint | note |
|---|---|---|---|---|---|
| Aryabhatta Hostel | 742764799 | none | 16 | 715 m2, 23.7 x 48.9 m | `tourism=hostel` |
| Bhaskara Hostel | 742764800 | none | 16 | 895 m2 | |
| HOSTEL BLOCK C | 742764801 | none | 16 | 851 m2 | no hostel name |
| HOSTEL BLOCK D | 742764802 | none | 16 | 868 m2 | no hostel name |
| Kautilya Block | 742764806 | 6 | 16 | 906 m2 | `addr:housenumber=Block E`, `building=dormitory` |
| HOSTEL BLOCK F | 742764805 | none | 16 | 805 m2 | no hostel name |
| HOSTEL BLOCK G | 742764804 | none | 16 | 898 m2 | no hostel name |
| Varahamihra [sic] Hostel | 742764803 | 6 | 16 | 781 m2, 27.0 x 53.7 m | `addr:housename=H Block Varahamihira` |
| Girls Hostel Block I - maitreyi | 742763426 | 6 | 28 | 877 m2 | |
| Girls Hostel Block J ( gargi ) | 742763425 | 6 | 28 | 840 m2 | |
| Kapila Block | 1021365360 | none | 6 | 13,697 m2 (126 x 127 m) | clearly a rough placeholder polygon |
| Ramanuja Hostel (east one) | 1021365358 | none | 4 | 1,709 m2 | rough rectangle |

Reading the letters: Block E = Kautilya, Block H = Varahamihira, Block I = Maitreyi, Block J = Gargi. By elimination A and B are Aryabhatta and Bhaskara (OSM puts `addr:housename=Bhaskara` on the "RECREATION ROOM" next to it), which leaves C, D, F, G. That gives eight A-H blocks plus I and J = 10 hostels, which equals gmp's "eight student hostels for boys and two student hostels for girls" (see section 3). This is my inference from letters; UNVERIFIED that A=Aryabhatta and B=Bhaskara. Blocks C, D, F, G could be Brahmagupta, Charaka, Susruta, Vyasa (the four names the official list has that OSM lacks), but nothing I found says which is which. UNVERIFIED.

New cluster, west side (lon 78.12222 to 78.12352, lat 17.59850 to 17.59947), all `building=college`, `building:levels=10`, 28 vertices, 840 m2:

| OSM name | way ID | footprint |
|---|---|---|
| Bhabha Hostel | 1270804254 | 52.7 x 27.1 m |
| Kalam Hostel | 1270804256 | 27.2 x 52.3 m (rotated 90 degrees) |
| Raman Hostel | 1270804257 | 52.7 x 27.1 m |
| Ramanuja Hostel (west one) | 1270804258 | 27.2 x 52.3 m |
| Sarabhai Hostel | 1270804255 | 52.7 x 27.1 m |
| Vishveshwaraiah Hostel | 1270804253 | 52.7 x 27.1 m |
| New Hostel 1 | 1270804259 | 52.4 x 27.2 m |
| New Hostel 2 | 1270804260 | 52.3 x 27.4 m |

All 8 are the same shape. Last edited 2024-04-08 (way 1270804254 v1, changeset 149720852, https://api.openstreetmap.org/api/0.6/way/1270804254.json). The prototype's "eight-block residential complex" fits this exactly. The prototype's list of those eight (Anandi Joshi, Bhabha, Kalam, Raman, Ramanujan, Sarabhai, Sarojini Naidu, Viswesvaraya) matches six OSM names; "New Hostel 1/2" could be Anandi and Sarojini Naidu (the two names the HCU page lists as girls' blocks, https://hostel.iith.ac.in/), but no source says so. UNVERIFIED.

Data-quality traps in the hostel tags (measured):
- All 8 new hostels carry `addr:housename=Gargi` (a copy-paste error).
- The new "Ramanuja Hostel" is probably "Ramanujan" (the official page has both Ramanuja and Ramanujan). UNVERIFIED which is which; OSM has two features called "Ramanuja Hostel".
- OSM has no Brahmagupta, Charaka, Susruta, Vyasa, Vivekananda, S N Bose, Kalpana Chawla, Anandi or Sarojini Naidu by name.
- Typos: "Varahamihra", "TABLE TENNN", "Foothpath", "Hostles".
- `building:levels=10` on the new blocks versus IITH's "ground plus 10-storey" (= 11 levels) in https://pr.iith.ac.in/newsletter/download/17/KID_20230401.pdf . The OSM wiki defines `building:levels` as "floors above ground, excluding roof floors" (https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings), so OSM may be one short. UNVERIFIED which is right.

Other buildings mapped by name (measured): Academic Block A (7 levels), B, C (7 levels), C Block Annex, Administrative Block, BioMed Building, Chemistry Department Building, Department of Computer Science and Electrical Engineering, Department of Design (4 levels), Department of Mathematics, Physics & Liberal Arts, Research Complex, Knowledge Research Centre (library), Lecture Hall Complex, MSME Building, Technology Incubation Park, Technology Research Park, Workshop Shed Labs, Convention Center, International Guest House (12,143 m2), Married Student Housing (MSH), IITH Hospital (2 levels), 4 x FACULTY TOWER (18 levels each) plus "FT", Old Hostel Mess (2 levels), New Hostel Mess, Old Gym, Gym and Fitness, Nescafe Coffee shop, Tinker's Lab. Not mapped as buildings: the Sports and Cultural Complex, the campus school (DAV School is an amenity polygon, not a building), the Civil, Mechanical, Material Science and Biotech buildings under those names (Academic Blocks A/B/C may cover some; UNVERIFIED), and much faculty/staff housing.

### 1.5 Evidence on the "two clusters / Hostel Circle" comment

The comment is at `docs/archive/viewer3d-v1.js` lines 513-516 in the Nivas repo: "the Hostel Office identifies two clusters on opposite sides of the hostel circle ... newer eight-block residential complex ... dense west cluster; the older blocks sit on the east side around the Hostel Circle road network."

What public sources say:
- OSM node 11728400508, "Hostel Circle Bus Stop" (`highway=bus_stop`, shelter, bench, lit), at 17.5967853 N, 78.1254338 E (https://api.openstreetmap.org/api/0.6/node/11728400508.json). OSM also has paths named "Hostel Circle - Old Hostel" and "Acad - Hostel Circle Foot Path" (the latter runs from lon 78.1208 to 78.1255, i.e. academic area to the circle).
- Derived from the footprints: the old A-J group has its centroid about 92 m east-south-east of the bus stop; the new 8-block group has its centroid about 353 m west-north-west of it; the two group centroids are about 393 m apart. So "new complex to the west, old blocks east around Hostel Circle" is supported. "Opposite sides of the hostel circle" is loosely right: the new group is clearly west; the old group is mostly east, but the stop itself sits at the old group's west edge rather than at the middle of the two.
- IITH Welcome Booklet 2022 (official): "IITH provides internal transport services between the Main Gate and the Hostel Circle and between the Hostel Circle and the New Hostels ... 4 electric vehicles which connect the Hostel Circle and the New Hostels and 3 buses which connect the Main Gate and the Hostel Circle." https://iith.ac.in/assets/files/pdf/welcome_Booklet_2022.pdf (page 12). So "Hostel Circle" and "New Hostels" are separate named places.
- The hostel office lists separate helplines for "Old Hostels", "New Hostels" and "Girls Hostels": https://hostel.iith.ac.in/ .
- IITH's RTI project list (as on 25/06/2021) shows Phase-1 "Hostel Blocks" and "Dining Hall" (L&T, 24-11-12 to 18-04-19) and, in Package 3B (Shapoorji Pallonji, started 01-08-19, stipulated completion 31-07-22), "Boys Hostel (8 Nos)", "Married Student Hostel", "Dining Hall": https://www.iith.ac.in/assets/files/pdf/rti/List-Of-Projects-as-on-25-06-2021.pdf . That matches the eight new blocks, the OSM "Married Student Housing" and "New Hostel Mess".
- ARCOP's 2012 master plan slides describe "Academic quad" and "Hostel quad" woven along a pedestrian spine: https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf (slide 9).
- Nothing found contradicts it. I did not find an official site plan that draws it.

### 1.6 Completeness verdict (honest)

- Buildings: PARTIAL. About 58 mapped; named hostels cover 20 of 23 official blocks; academic cluster is mostly there; several Phase-II buildings and housing are missing or are crude rectangles (4-6 vertex polygons for Kapila, Ramanuja east, MSH, Convention Center). Good enough to place hostels, mess halls, academic blocks and landmarks in the right places and to draw correct footprints for about 30 buildings (the ones with 16 or 28 vertices).
- Heights: POOR. No `height`; levels on 21 of 58; hostels A-H have no levels. Use IITH documents (6 floors old, G+10 new) rather than OSM.
- Facade or roof data: NONE.
- Roads and paths: GOOD (187 ways, many named, with `surface` and `lit`).
- Trees, water, landuse: NONE mapped. ARCOP says 14% of the site is an urban-forest "green lung", swales 4% and lakes 2.3%, so these exist in the design but not in OSM: https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf (slides 12, 14).
- Pitches: GOOD for 7 pitches and the athletics track; no cricket, no pool.
- Recency: recently edited (hostel footprints April 2024; bus stop node Feb 2025; Overpass snapshot is today), so it is being maintained, by a small number of editors.
- Overall: enough to bootstrap about 60 buildings and a road network, then hand-fix. Not enough for terrain, vegetation or realistic heights.

---------------------------------------------------------------------------

## 2. Other legitimate sources, and licences / attribution

### 2.1 OpenStreetMap (ODbL)

Licence text: https://opendatacommons.org/licenses/odbl/1-0/ (I am summarising, this is not legal advice).
- Section 4.3: creating a Produced Work needs no notice, but if you Publicly Use it you must include a notice that the content came from the Database and is available under the ODbL.
- Section 4.4 (share-alike): a Derivative Database that you Publicly Use must be licensed under the ODbL (or a compatible licence). Extracting or re-using a Substantial part of the contents into a new database creates a Derivative Database.
- Section 4.5: share-alike does not extend to a Collective Database (the unmodified OSM data as one of several independent databases), and creating a Produced Work does not create a Derivative Database.
- Section 4.6: if you Publicly Use a Derivative Database or a Produced Work from one, you must offer recipients a machine-readable copy of the whole Derivative Database (or the alterations/method). Free over the internet.
- "Substantial" is quantity or quality, and repeated systematic extraction can add up.

OSMF attribution guideline (adopted 2021-06-25): https://osmfoundation.org/wiki/Attribution
- "Attribution must be to 'OpenStreetMap.'" and it must make clear the data is under the ODbL, e.g. by linking the word OpenStreetMap to https://www.openstreetmap.org/copyright .
- Accepted older forms: "(c) OpenStreetMap contributors" and "(c) OpenStreetMap". For restyled data: "Map data from OpenStreetMap".
- Interactive maps: credit in a corner of the map (or adjacent, or on a start splash screen); it may collapse after interaction or five seconds, provided licence information stays findable, for example an "(i)" button or an About menu.
- Databases: "attribution to OpenStreetMap and either the ODbL text or a link to it", placed where users would look, such as a readme or the data's metadata.
- Games and simulations: credit on a splash, in-view, credits page or menu is acceptable.
- 3D models are not specifically covered. https://www.openstreetmap.org/copyright says: "If you alter or build upon our data, you may distribute the result only under the same license."

Produced Work vs database: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline says if the published result "is intended for the extraction of the original data" it is a database; images such as PNG/JPG/SVG are usually Produced Works. The guideline does not mention 3D models. Substantial test: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline says extractions under 100 features are treated as not Substantial if one-off, and systematic extractions do not qualify for that exception; a "Feature" is a way or independent node (nodes inside a way do not count separately). The guideline's own village example leaves building outlines out of its tally because there are so many, and that example is a special allowance for areas of up to 1,000 inhabitants. IITH has 187 highway ways, 58 buildings and 11 leisure ways, about 256 features; the roads alone are over 100, so a road-plus-building extract is over the threshold whichever way buildings are counted.

What this means for us (my reading, UNVERIFIED by a lawyer):
- The rendered 3D view is a Produced Work: show "(c) OpenStreetMap contributors" linked to /copyright in a corner or About panel, plus "Open Database License".
- The baked JSON of footprints, hosted on the site, is a Derivative Database: it must be offered under the ODbL (put a `LICENSE-DATA`/README and a `"license"` and `"attribution"` field in the JSON), with attribution. If it is hosted publicly it already satisfies the "offer a copy" duty, because it is the copy.
- The Nivas repo is public under the MIT licence (from the project notes). An OSM-derived data file inside it needs its own licence notice (ODbL), not MIT.
- Keep the app's own data (rooms, listings) in separate databases (a Collective Database): ODbL share-alike does not reach them as long as OSM data is not merged into them in modified form.
- Own survey escape hatch: hostel footprints and heights taken from IITH drawings, or measured by us, are not OSM-derived and carry no ODbL duty. The existing Varahamihira trace comes from an architect's plan, not OSM.
- Do not trace from Google Maps/Earth, Bing, or other tile imagery; their terms forbid it for our use. OSM itself may be used.

### 2.2 Other open footprint datasets (no names, no heights, ML-detected)

| Source | Licence (as stated by the owner) | Covers India | Heights |
|---|---|---|---|
| Google Open Buildings v3 https://sites.research.google/gr/open-buildings/ | CC BY 4.0 or ODbL v1.0 (your choice) | Yes ("IND India") | No |
| Microsoft GlobalMLBuildingFootprints https://github.com/microsoft/GlobalMLBuildingFootprints | CDLA Permissive 2.0 (no attribution requirement stated on the page) | Yes ("India (110M)") | Some, `-1` when absent |

I did not test whether either dataset has a good polygon for each IITH hostel. UNVERIFIED. They would not tell hostels apart.

### 2.3 Imagery and photographs

- Wikimedia Commons "Category:IIT Hyderabad" (https://commons.wikimedia.org/wiki/Category:IIT_Hyderabad): 30 files at the time of the check, no aerial views, one hostel-related file. Licences via the Commons API (https://commons.wikimedia.org/w/api.php, extmetadata):
  - CC0: "Central Library IIT Hyderabad, Knowledge Resource centre IIT Hyderabad.jpg" (3072 x 4096, Mukesh721, 2025-06-01); "Civil Engineering block IIT Hyderabad.jpg" (1920 x 1080, Mukesh721, 2025-06-01); "IIT Hyderabad Campus, Sanga Reddy District, Telangana.jpg" (4096 x 1864, Rohitjahnavi, taken 2026-08-02); "Hostles iith.jpg" (1600 x 1200, Hitokiri01, 2012-10-20; a 2012 date predates the Kandi hostels, so it probably shows the temporary campus; UNVERIFIED).
  - CC BY-SA 4.0 (credit + share-alike on adaptations): "IIT(Hyderabad).jpg" (3024 x 4032, Akshithk07, 2022-11-18); "IIT Hyderabad.png" (767 x 539); "Scrap Art Amphitheatre at IIT Hyderabad.jpg" (4096 x 3072, 2026); three tiny 2015 thumbnails by Venkataous.
  - Practical value: low. Nothing shows the hostel facades usably.
- OpenAerialMap (CC BY 4.0 imagery): queried the API for the campus box, `found: 0`. https://api.openaerialmap.org/meta?bbox=78.115,17.579,78.132,17.606 . So no open drone or aerial imagery.
- Mapillary street-level imagery (CC BY-SA): not checked, needs an API token. UNVERIFIED whether the campus is covered.
- Wikipedia text: CC BY-SA 4.0 (https://en.wikipedia.org/wiki/IIT_Hyderabad); its infobox map is an OSM-based image.

### 2.4 Elevation (the campus is on a hill; ARCOP designed around the topography)

- ARCOP: "minimal site intervention", lakes in depressions, "strong natural surface run off towards the regional level lakes": https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf (slides 5-6).
- Copernicus DEM GLO-30 (30 m) / GLO-90 (90 m), Cloud Optimized GeoTIFF, "free basis for the general public", suggested citation "Copernicus Digital Elevation Model (DEM) was accessed on DATE from https://registry.opendata.aws/copernicus-dem": https://registry.opendata.aws/copernicus-dem/ . The page notes GLO-30 Public has limited worldwide coverage (some countries not released); UNVERIFIED whether India's GLO-30 tiles are public. GLO-90 is worldwide. 30 m cells are coarse for a 2.8 x 1.7 km site. No higher-resolution open DEM found.

### 2.5 IITH, JICA, ARCOP and press material (facts usable, images are not)

- IITH Welcome Booklet 2022: https://iith.ac.in/assets/files/pdf/welcome_Booklet_2022.pdf . Contains a campus image but I could not read it as a map. I found no official campus map PDF on iith.ac.in. An older map PDF on a department subdomain exists (https://people.iith.ac.in/memslab/MEMSSymposium/IITH%20Map%20website.pdf, 2014, UNVERIFIED content). A 2019 IITH master's thesis, "3D Digital Interactive Model of IIT Hyderabad Campus" (V. Thakre, IITH Department of Design), is listed in the IITH repository and says it used maps from the campus Estate Office; the repository host did not resolve when I tried (raiithold.iith.ac.in), so I could not read it. Prior art worth asking about.
- JICA "Campus Design Project for IIT Hyderabad, Detail Design Assistance (Phase 3), Final Report", October 2014: https://openjicareport.jica.go.jp/pdf/12182440_01.pdf . The site shows "Copyright (c) JICA. All rights reserved." (https://openjicareport.jica.go.jp/). Treat drawings and photos as not reusable without permission; facts are fine to cite.
- ARCOP presentation (2012-12-11): https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf . Copyright ARCOP; facts only.
- Press and award pages (theplan.it, re-thinkingthefuture.com, archdaily.com, stirworld.com): copyright their owners. theplan.it and re-thinkingthefuture.com sit behind a Cloudflare challenge, so I could not open them; what I report from them came only through search-engine excerpts. UNVERIFIED in the strict sense.
- Indian rules on map data: the February 2021 Geospatial Guidelines removed prior approval for collecting and publishing map data in India (self-certification), with some sensitive feature categories restricted: https://wiki.openstreetmap.org/wiki/India/Government_of_India (a wiki summary, last edited August 2022). A university campus is not one of the sensitive categories I saw. The government's open data portal licence is GODL-India (same page). I did not find a Survey of India or Bhuvan dataset for this campus. UNVERIFIED.

---------------------------------------------------------------------------

## 3. Checkable facts about the hostel architecture

### 3.1 Who designed what

| Claim | Source | Status |
|---|---|---|
| ARCOP Associates (Indian subsidiary of a Canadian-based design office) was selected in April 2009 as master-plan consultant; it submitted the "IITH Campus Development Draft Master Plan" in January 2010; "no revision for the master plan as of Oct 2014" | JICA report, section 1.1, https://openjicareport.jica.go.jp/pdf/12182440_01.pdf | Verified (primary) |
| ARCOP's stated role: master planner, urban designer, landscape designer, architects for academic buildings | ARCOP slides, slide 4, https://www.grihaindia.org/events/innovation/pdf/ppt/vaibhav-jagjit.pdf | Verified |
| Three firms selected from an international competition; "dining halls and students hostels were assigned to ARCOP, New Delhi and GMP Architects, Berlin, Germany" | CCBA's own page https://www.ccba.in/project/department-of-physics,-mathematics-&-liberal-arts-(ad-3),-iit-h | Verified as the firm's statement |
| ASTUTE Engineering Services (Pune) was the local architect/consultant providing "design services for the Hostel buildings, Dining Hall and the Main building", one of three consultants besides ARCOP and CCBA | JICA report, section 1.3.3 | Verified |
| gmp (von Gerkan, Marg und Partner) with ASTUTE won "all student hostels and the associated dining halls", plus administration building, campus school and clinic | search excerpts of https://www.theplan.it/eng/award-2018-Housing/student-housing-iit-campus-hyderabad-india-1 and https://www.re-thinkingthefuture.com/case-studies/a15167-iit-hyderabad-hostels-by-gmp-von-gerkan-marg-and-partners/ | UNVERIFIED (pages blocked; consistent with the CCBA and JICA statements) |
| Christopher Benninger (CCBA) designed the Lecture Hall Complex (completed 2024, built-up 15,763 m2) | https://www.archdaily.com/en/1027596/lecture-hall-complex-iit-hyderabad-ccba-designs | Verified |
| University of Tokyo IIS experts did design work for six complexes (JICA-funded), work commenced 2011, completed 2024: Knowledge Centre, International Guest House, Convention Center, Sports and Cultural Complex, Technology Incubation Park, Research Center Complex | https://www.iis.u-tokyo.ac.jp/en/research/archive/4661 and JICA report section 1.1 | Verified |
| Wikipedia says "the hostels, Lecture Hall, and academic departments were designed by Prof. Christopher Charles Benninger" | https://en.wikipedia.org/wiki/IIT_Hyderabad | CONTRADICTED by CCBA's own page and JICA; do not repeat |
| Who designed the eight new 10-storey blocks (Package 3B, 2019-2022) | not found in any source | UNKNOWN |

### 3.2 Old hostels (Phase 1, first 10 blocks, the OSM A-J group)

- Phase 1 was "eight student hostels for boys and two student hostels for girls, each with 196 single rooms", plus dining halls, "completed and occupied at the end of 2016" per re-thinkingthefuture; theplan.it dates completion 2017 and lists gross area 57,770 m2. UNVERIFIED (excerpts only, and the two dates disagree).
- Layout: clusters inspired by a plant system; each cluster has four "leaves" (buildings) in alternating sequence joined by "branches" (corridors); semi-public space opens to the dining halls at ground level; two clusters of sixteen single rooms around a shared communal space on standard floors. UNVERIFIED (same sources).
- Height: "Each hostel block has six floors", IITH Welcome Booklet 2022 (page 13): https://iith.ac.in/assets/files/pdf/welcome_Booklet_2022.pdf . Verified (official). OSM `building:levels=6` on Varahamihira, Kautilya, Maitreyi, Gargi agrees. Whether "six floors" means ground+5 or ground+6 is not stated.
- Structure and finish at construction (JICA site photos, October 2014): "HOSTEL: Most of the concrete frames are completed"; radiant cooling "installed above the slab" rather than embedded; "SHADING FIN: Simple and easy installation"; for the dining hall "The quality of the exposed concrete is good"; the local white limestone "Bettam Chara" is widely used but brittle. Source: JICA report, section 2.2, pages 2-4 to 2-6. These are captions from construction photos; the report does not say which facade finish is on each hostel. Treat "exposed concrete frame, shading fins, stone" as plausible, not confirmed for the hostels.
- IITH says hostels have "independent living spaces with natural ventilation and diffused lighting" and a "radiant cooling system": https://pr.iith.ac.in/newsletter/download/17/KID_20230401.pdf (the PDF's own masthead reads "Volume 5 | Issue 4 | Oct - Dec 2023", though the file name says 20230401).
- Total capacity of this Phase: Wikipedia says "10 functioning hostel buildings, each with a capacity of 200" in "Phase 1A ... completed in March 2019" (https://en.wikipedia.org/wiki/IIT_Hyderabad); IITH's RTI list gives Phase-1 completion 18-04-19. Wikipedia and gmp differ on 196 vs 200; both approximate.

### 3.3 New hostels (Package 3B, the OSM west cluster of 8)

From IITH's own newsletter (Dean Planning), https://pr.iith.ac.in/newsletter/download/17/KID_20230401.pdf , page 2: "Each hostel building is a ground plus 10-storey structure. Each building of 316 capacity consists of four clusters on one level and is provided with four extra-sized rooms. Each cluster includes eight single bedrooms with shared toilets and a common sitting area." Facade: "characterized by vertical fins ... Fin angles are with two modes to reduce solar impact." Radiant cooling. "Solar photovoltaics are fitted at the top." Verified (official). Arithmetic check: four clusters x eight rooms plus four extra rooms is 36 per level, which does not obviously give 316 across ten levels; I do not know how many levels are residential. UNVERIFIED capacity per floor.
- Dining hall (new): "two floors", "simultaneous dining capacity of 500 on each floor", "designed for 2000 students", "fair-faced concrete", "large column-free space". Same source, page 3. Verified.
- Package 3B contract: "Boys Hostel (8 Nos)", L&T was the Phase-1 contractor and Shapoorji Pallonji the Package 3B contractor: https://www.iith.ac.in/assets/files/pdf/rti/List-Of-Projects-as-on-25-06-2021.pdf . Verified.
- A search-engine summary said the April 2023 newsletter mentions "complete precast technology" for additional hostels for about 1,000 boarders. I read the PDF at the URL above (3 pages) and it does NOT contain "precast". So that claim is UNVERIFIED; it may be in a different issue.
- Dimensions of this type (OSM): 840 m2, about 52.5 x 27.2 m, 28-vertex outline; see section 1.4.

### 3.4 Other checkable facts a model could use

- Radiant cooling and district cooling in the original plan; hostels' target energy-performance index in the master plan is listed as "1 kwh / sqm / yr" (ARCOP slide 20; looks like a placeholder, UNVERIFIED).
- Dining hall (Phase 1): exposed concrete (JICA photo caption).
- Convention Center: ground+3, five towers, fair-faced exposed concrete; Knowledge Resource Centre: ground+3, dry-stone cladding up to 11 m, hyperbolic paraboloid shell roofs; Sports and Cultural Complex: ground+1, concrete shell roof of 45 m span; Lecture Hall Complex: two levels, 15 halls; Physics block: ground+4: all in https://pr.iith.ac.in/newsletter/download/17/KID_20230401.pdf (pages 1-3). Useful for non-hostel buildings.
- Site layout: "a residential zone with clustered student dormitories is located at the northern edge of the campus", and the Sports and Cultural Complex sits next to it: https://www.archdaily.com/1039548/sports-and-cultural-complex-iit-hyderabad-iith-campus-design-team-of-the-university-of-tokyo-plus-nihon-sekkei-plus-apl-design-workshop . OSM agrees: hostels at lat about 17.597-17.600, the athletic track at 17.6023.

### 3.5 Hostel names: official list versus Nivas list (needs your call)

The official hostel page https://hostel.iith.ac.in/ (fetched 2026-10-13) says "There are 23 hostel blocks (16 for boys and 6 for girls)" but its lists show:
- Girls: Aryabhatta, Bhaskara, Maitreyi, Gargi, Kalpana Chawla, Anandi, Sarojini Naidu, Kapila (for project staff and interns) = 8 entries, so "6 for girls" does not match the list.
- Boys: Charaka, Susruta, Kautilya, Vyasa, Brahmagupta, Varahamihira, Ramanuja, Vivekananda, SN Bose, Ramanujan, Raman, Kalam, Bhabha, Sarabhai, Viswesweraya, Kapila = 16 entries.
- Double-sharing: Kalpana Chawla, Ramanuja, Vivekananda, SN Bose; Kapila is "dual sharing for Non-Regular Students".
- Hostel Coordinating Unit is in the "Pavilion Block in between Kautilya & Vyasa".
So the official site puts Aryabhatta and Bhaskara among the girls' blocks, and has Ramanuja, Vivekananda and SN Bose in the boys' list, none of which match the 15-name boys' list in Nivas. Either the Nivas list is outdated, the site has changed, or the site contains errors. I cannot tell which. UNVERIFIED. Wikipedia says only "23 hostel buildings, of which six house female students exclusively" and names none.

### 3.6 Scale cross-check you may want to run (my computation, low confidence)

The Nivas v2 viewer states `PLAN_SCALE = .0254` ("one plan pixel is about 5 cm") with a floor height of 1.6 scene units (about 3.2 m), so 1 scene unit is about 2 m. The traced outline (480 points in `plan-geometry.js`) spans 38.0 x 19.9 scene units, which is about 76 x 40 m real, about 1,800 m2. The OSM new-type block is 52.5 x 27.2 m (840 m2), the old type 27 x 54 m (about 780-900 m2). The aspect ratios are close (traced 1.91, OSM new-type 1.93) but absolute size differs by about 1.45 times. Either the 5 cm per pixel is off, the traced outline includes balconies that OSM excludes, or the plan is not the OSM building. Check before placing the detailed model on a campus map.

Also note the model has ten floors (new type) but Nivas defaults to "Varahamihira", which OSM and IITH's 2022 booklet place in the older six-floor group. Worth confirming which block the architect's plan actually is.

---------------------------------------------------------------------------

## 4. Practical technical numbers

### 4.1 Payload (measured, then estimated)

Measured on the 58 real IITH building footprints (all polygons are simple closed ways, 822 vertices in total; mean 14.2, median 10.5, max 65 per building; footprint area min 19 m2, median 891 m2, max 13,697 m2):
- Compact JSON with name, levels and ring in local metres at 0.1 m precision, no whitespace: 13,967 bytes (about 241 bytes per building).
- Same in raw latitude/longitude at 6 decimals: 19,757 bytes (about 341 bytes per building).
- Gzipped: about 5.1 KB either way.
Estimate for "a few hundred" buildings: 300 buildings at the same complexity is about 72 KB raw and 26 KB gzipped. IITH itself only has 58 mapped, so a 300-building figure would need either surrounding villages or hand-added buildings. Roads: 187 ways; I did not measure their vertex count, so no number. Extruded triangles (derived): about 2 triangles per wall edge plus about (n-2) per roof, so about 2,400 triangles for all 58 buildings; trivial for a phone.

### 4.2 InstancedMesh versus merged geometry

- three.js InstancedMesh: "Use this class if you have to render a large number of objects with the same geometry and material(s) but with different world transformations." https://threejs.org/docs/pages/InstancedMesh.html . Instancing needs the SAME geometry. Footprint extrusions are all different shapes, so instancing does not fit them.
- The exception is the eight identical new hostel blocks (same 28-vertex, 840 m2 footprint): one geometry plus eight transforms (rotation 0 or 90 degrees; New Hostel 1 and 2 are about 86 degrees per my fit, so check their rotation).
- For everything else the three.js manual's route is merging: "Drawing 2 things has more overhead than drawing 1 even if the results are the same so one way to optimize is to merge meshes", with the caveats that you get one material (use vertex colours) and "it's no longer easy to move any part": https://threejs.org/manual/pages/optimize-lots-of-objects.html . `BufferGeometryUtils.mergeGeometries(geometries, useGroups)` "Returns null if the merge does not succeed" when attributes are incompatible: https://threejs.org/docs/pages/module-BufferGeometryUtils.html . A forum reply (not authoritative) notes merging defeats per-object frustum culling: https://discourse.threejs.org/t/how-can-i-optimise-my-three-js-rendering/42251/2 .
- No source I found gives a hard draw-call limit for phones. discoverthreejs says only "fewer draw calls = better performance", "Use geometry instancing when you have hundreds or thousands of similar geometries", and to cap pixel ratio at 2 or 3 on mobile: https://discoverthreejs.com/tips-and-tricks/ . Test on a mid-range Android; I have not.
- Design implication (my reasoning, not a source): keep the roughly 20 hostel buildings as individually pickable meshes (the app needs to select one), merge the other roughly 40 buildings and the roads into a few vertex-coloured meshes, and instance the 8 new blocks.

### 4.3 Client-side OSM versus pre-baked JSON

Reasons to pre-bake (all sourced or measured):
- Overpass usage policy: "less than 10,000 queries per day" and "less than 1 GB per day" as the baseline, "scale those numbers down by 100" for regular use; "If you have an app or website, then the usage counts towards the sum of requests made by all your users"; "Cache and rate-limit calls"; apps should send an identifying User-Agent or Referer; after 429 or 406 wait 30 seconds; "Nowadays this server is overloaded." https://wiki.openstreetmap.org/wiki/Overpass_API . Our own experience matched: 5 of 12 data requests failed with "server is probably too busy" and one gave a 504 in about 10 minutes.
- The same page says AI-generated apps should not be hosted on fast-deployment platforms such as lovable.app or netlify.app; Nivas is on Hostinger shared hosting, so it is not caught by that, but a fair-use app with many students would still count against the shared limit.
- Overpass does send `Access-Control-Allow-Origin: *` (seen on a 504 response header), so browser calls are technically possible.
- Nivas vendors three.js "so it works on locked-down campus networks" (project notes); a live call to an external OSM server from a campus network is an extra failure mode.
- OSM is edited by anyone: the data has typos and copy-paste errors today (section 1.4); a live fetch would show vandalism or retagging directly in the model. A pre-baked file lets you review, fix and pin the OSM way IDs and the `timestamp_osm_base`.
- Pre-baking also makes the licence handling in section 2.1 simple: one file, one notice.
Reasons to fetch live: none that matter here; the campus changes slowly.

---------------------------------------------------------------------------

## 5. Gaps and unknowns

1. Which of Blocks C, D, F, G is Brahmagupta, Charaka, Susruta or Vyasa, and whether A and B are Aryabhatta and Bhaskara. No source. The Hostel Office would know.
2. Which hostels are the eight new blocks. OSM names six; "New Hostel 1/2" are unidentified (Anandi, Sarojini Naidu?). Where Vivekananda, S N Bose and Kalpana Chawla are. Three of the 23 official blocks have no OSM footprint I can name.
3. Whether Aryabhatta and Bhaskara are girls' or boys' hostels now (official page versus Nivas list), and why the official page says "6 for girls" but lists 8.
4. Whether Varahamihira is a six-floor old block (OSM, booklet) or a ten-floor new block (what the Nivas model shows); and the real scale of the traced plan (section 3.6).
5. Who designed the eight new 10-storey blocks. gmp's role is documented only for the first phase, and only through search excerpts because the pages are behind Cloudflare.
6. Whether OSM's `building:levels=10` means ground+9 or the official ground+10.
7. Facade materials on the hostels. Official text mentions vertical fins (new type), shading fins and radiant cooling; exposed or fair-faced concrete is documented for the dining hall, convention centre and library, not for the hostels. No source gives a hostel colour, a window size or a balcony detail.
8. Precast construction claim (unverified, see 3.3).
9. Terrain: no usable open DEM confirmed for the campus (Copernicus GLO-30 India coverage unverified; 30 m cells are coarse).
10. Trees, lakes, grass: not in OSM. ARCOP gives percentages only. IITH reports "more than 15000 trees" planted in two years (newsletter), no map.
11. Cricket grounds and swimming pool: not in OSM.
12. Mapillary coverage unchecked (needs a token).
13. Open vs restricted use of an official IITH campus map or the Estate Office plans: none found online. A 2019 IITH M.Des thesis on a 3D campus model exists but I could not open it; it would be the first thing to ask the Department of Design or the Estate Office about.
14. Legal reading of ODbL for this exact use (derived JSON plus MIT repo) is my interpretation of the OSMF guidelines, not legal advice.
15. Real-device mobile performance, and whether Hostinger serves JSON gzipped, were not tested.

---------------------------------------------------------------------------

## Appendix: Overpass queries used (all against https://overpass-api.de/api/interpreter)

1. Boundary: `way(around:2500,17.5935,78.1230)["amenity"="university"]` plus relation, `landuse=education`, and name regex "Indian Institute|IIT", `out tags bb`.
2. Counts inside `way(305851274);map_to_area->.c;` for building (way+relation), named, levels, height, type values, building=dormitory, building=yes, colour/material/roof tags, `out count`.
3. All buildings in the polygon, `out tags center` (58 elements).
4. Counts of highway, footway-like, road-like, `natural=tree`, tree_row, natural/waterway/water, landuse, leisure, sport; then tags of natural, waterway, landuse, leisure and non-building amenities.
5. Named highways in the polygon; count of buildings in 17.570-17.620 N, 78.100-78.150 E outside the polygon; name regex "circle".
6. `way["building"](area.c); out geom;` (58 buildings with geometry, 74 KB) for vertex statistics.
