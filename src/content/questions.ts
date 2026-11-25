import type { TopicId } from '../config';

/**
 * The canonical answer database.
 *
 * Format of `answers`: answers separated by ";". Within an answer, the first name is the
 * canonical display name and "|" separates accepted aliases. "=N" sets the curated
 * provisional estimate (percent of players expected to give this answer). Answers without
 * an estimate default to DEFAULT_EST. Estimates are only used until a question has enough
 * real responses (see GAME.minSampleSize) and are always labelled as estimates in the UI.
 *
 * `suffix` lets players add or drop a trailing word ("great white" = "great white shark").
 */
export interface QuestionSource {
  id: string;
  topic: TopicId;
  /** 1 easy, 2 medium, 3 hard */
  difficulty: 1 | 2 | 3;
  text: string;
  suffix?: string;
  answers: string;
}

export const DEFAULT_EST = 0.5;

export const QUESTION_SOURCES: QuestionSource[] = [
  // ───────────── Geography ─────────────
  {
    id: 'geo-africa', topic: 'geography', difficulty: 1, text: 'Name a country in Africa',
    answers: `Egypt=22;Nigeria=16;South Africa|RSA=14;Kenya=9;Morocco=7;Ghana=5;Ethiopia=5;Algeria=3;Tunisia=2.5;Senegal=2;Uganda=2;Tanzania=2;Cameroon=2;Zimbabwe=1.8;Libya=1.6;Sudan=1.5;Madagascar=1.5;Rwanda=1.4;Somalia=1.2;Republic of the Congo|Congo|Congo-Brazzaville|Congo Republic=1.1;Democratic Republic of the Congo|DR Congo|DRC|Congo-Kinshasa|Zaire=1;Angola=1;Mali=0.9;Ivory Coast|Côte d’Ivoire|Cote d'Ivoire=0.9;Zambia=0.8;Botswana=0.8;Namibia=0.8;Mozambique=0.7;Niger=0.7;Chad=0.6;Burkina Faso;Benin;Togo;Sierra Leone;Liberia;Guinea;Guinea-Bissau;The Gambia|Gambia;Mauritania;Eritrea;Djibouti;South Sudan;Central African Republic|CAR;Gabon;Equatorial Guinea;São Tomé and Príncipe|Sao Tome|Sao Tome and Principe;Cape Verde|Cabo Verde;Malawi;Lesotho;Eswatini|Swaziland;Burundi;Comoros;Mauritius;Seychelles`,
  },
  {
    id: 'geo-south-america', topic: 'geography', difficulty: 1, text: 'Name a country in South America',
    answers: `Brazil=34;Argentina=24;Colombia=10;Peru=8;Chile=8;Venezuela=5;Ecuador=4;Bolivia=3;Uruguay=2.5;Paraguay=1.5;Guyana=0.6;Suriname=0.4`,
  },
  {
    id: 'geo-europe-capital', topic: 'geography', difficulty: 1, text: 'Name a capital city in Europe',
    answers: `Paris=24;London=17;Rome=10;Berlin=10;Madrid=8;Athens=5;Amsterdam=4;Vienna=3;Lisbon=3;Dublin=2;Prague=2;Brussels=2;Stockholm=1.5;Oslo=1.3;Copenhagen=1.3;Warsaw=1.2;Budapest=1.2;Helsinki=1;Moscow=1;Bern|Berne=0.8;Kyiv|Kiev=0.8;Bucharest;Sofia;Belgrade;Zagreb;Ljubljana;Bratislava;Vilnius;Riga;Tallinn;Reykjavík;Valletta;Luxembourg|Luxembourg City;Monaco;Andorra la Vella;San Marino;Vaduz;Chișinău|Chisinau;Minsk;Tirana;Skopje;Podgorica;Sarajevo;Pristina;Nicosia;Vatican City|Vatican`,
  },
  {
    id: 'geo-us-state', topic: 'geography', difficulty: 1, text: 'Name a US state',
    answers: `California=20;Texas=15;Florida=12;New York=11;Washington=3;Hawaii=3;Alaska=3;Nevada=2;Ohio=2;Illinois=2;Georgia=2;Arizona=2;Colorado=1.5;Michigan=1.5;New Jersey=1.4;Pennsylvania=1.2;Massachusetts=1.2;Oregon=1.1;Louisiana=1.1;Tennessee=1;Utah=1;Alabama;Arkansas;Connecticut;Delaware;Idaho;Indiana;Iowa;Kansas;Kentucky;Maine;Maryland;Minnesota;Mississippi;Missouri;Montana;Nebraska;New Hampshire;New Mexico;North Carolina;North Dakota;Oklahoma;Rhode Island;South Carolina;South Dakota;Vermont;Virginia;West Virginia;Wisconsin;Wyoming`,
  },
  {
    id: 'geo-asia', topic: 'geography', difficulty: 2, text: 'Name a country in Asia',
    answers: `China=22;Japan=18;India=14;South Korea|Korea|Republic of Korea=6;Thailand=5;Vietnam|Viet Nam=4;Indonesia=3;Philippines=3;Pakistan=2;Singapore=2;Malaysia=2;North Korea|DPRK=1.5;Nepal=1.2;Bangladesh=1.2;Sri Lanka=1;Mongolia=1;Cambodia=0.9;Afghanistan=0.9;Iran=0.9;Iraq=0.8;Saudi Arabia=0.8;Israel=0.7;Turkey|Türkiye|Turkiye=0.7;Russia=0.6;Laos;Myanmar|Burma;Bhutan;Maldives;Brunei;Timor-Leste|East Timor;Taiwan;Kazakhstan;Uzbekistan;Kyrgyzstan;Tajikistan;Turkmenistan;Jordan;Lebanon;Syria;Kuwait;Qatar;Bahrain;United Arab Emirates|UAE;Oman;Yemen;Armenia;Azerbaijan;Georgia;Cyprus;Palestine|State of Palestine`,
  },
  {
    id: 'geo-borders-china', topic: 'geography', difficulty: 3, text: 'Name a country that borders China',
    answers: `Russia=25;India=20;Mongolia=10;North Korea|DPRK=10;Vietnam|Viet Nam=8;Pakistan=6;Nepal=5;Kazakhstan=3;Laos=2;Myanmar|Burma=2;Bhutan=1.5;Afghanistan=1.2;Kyrgyzstan=1;Tajikistan=0.8`,
  },
  {
    id: 'geo-canada', topic: 'geography', difficulty: 2, text: 'Name a Canadian province or territory',
    answers: `Ontario=30;Quebec|Québec=25;British Columbia|BC=15;Alberta=10;Nova Scotia=5;Manitoba=3;Saskatchewan=3;Newfoundland and Labrador|Newfoundland=3;New Brunswick=2;Prince Edward Island|PEI=1.5;Yukon=1.5;Northwest Territories|NWT=0.8;Nunavut=0.7`,
  },
  {
    id: 'geo-eu', topic: 'geography', difficulty: 1, text: 'Name a country in the European Union',
    answers: `France=22;Germany=20;Italy=12;Spain=10;Greece=5;Netherlands|Holland|The Netherlands=4;Belgium=3;Portugal=3;Austria=3;Poland=2.5;Sweden=2;Ireland=2;Denmark=2;Finland=1.5;Czechia|Czech Republic=1.2;Hungary=1.2;Croatia=1;Romania=1;Bulgaria=0.8;Slovakia=0.7;Slovenia=0.7;Luxembourg=0.7;Malta;Cyprus;Estonia;Latvia;Lithuania`,
  },
  {
    id: 'geo-100-million', topic: 'geography', difficulty: 2, text: 'Name a country with more than 100 million people',
    answers: `China=28;India=25;United States|USA|US|United States of America|America|U.S.A.=20;Indonesia=5;Brazil=5;Russia=4;Pakistan=2.5;Nigeria=2.5;Japan=2.5;Mexico=2;Bangladesh=1.5;Ethiopia=0.8;Philippines=0.8;Egypt=0.8;Vietnam|Viet Nam=0.6;Democratic Republic of the Congo|DR Congo|DRC|Congo-Kinshasa`,
  },
  {
    id: 'geo-australia', topic: 'geography', difficulty: 2, text: 'Name an Australian state or territory',
    answers: `New South Wales|NSW=25;Queensland=22;Victoria=20;Western Australia|WA=12;South Australia|SA=8;Tasmania=7;Northern Territory|NT=4;Australian Capital Territory|ACT=2;Jervis Bay Territory=0.1`,
  },

  // ───────────── Animals ─────────────
  {
    id: 'ani-flightless', topic: 'animals', difficulty: 1, text: 'Name a bird that can’t fly',
    answers: `Penguin|Emperor penguin|King penguin|Adélie penguin|Gentoo penguin=32;Ostrich=24;Emu=14;Kiwi=10;Dodo=8;Cassowary=4;Rhea=1;Kākāpō|Kakapo=1;Moa=0.6;Takahē|Takahe=0.5;Weka;Steamer duck;Great auk;Elephant bird;Flightless cormorant|Galápagos cormorant;Inaccessible Island rail`,
  },
  {
    id: 'ani-chinese-zodiac', topic: 'animals', difficulty: 1, text: 'Name an animal of the Chinese zodiac',
    answers: `Dragon=25;Rat=15;Tiger=12;Snake=7;Monkey=6;Horse=6;Rabbit|Hare=5;Goat|Sheep|Ram=5;Rooster|Chicken|Cock=5;Dog=4;Pig|Boar=4;Ox|Bull|Cow|Buffalo=3`,
  },
  {
    id: 'ani-marsupial', topic: 'animals', difficulty: 2, text: 'Name a marsupial',
    answers: `Kangaroo=40;Koala=25;Wombat=8;Opossum=5;Tasmanian devil=5;Wallaby=4;Possum=3;Sugar glider=2;Quokka=2;Bandicoot=1;Numbat=0.6;Bilby=0.5;Quoll=0.5;Thylacine|Tasmanian tiger;Cuscus;Tree kangaroo;Wallaroo;Pademelon;Potoroo;Bettong;Dunnart;Antechinus;Marsupial mole;Phascogale;Kowari;Monito del monte;Shrew opossum`,
  },
  {
    id: 'ani-shark', topic: 'animals', difficulty: 2, text: 'Name a type of shark', suffix: 'shark',
    answers: `Great white shark|White=35;Hammerhead shark=18;Tiger shark=8;Whale shark=8;Bull shark=5;Mako shark|Shortfin mako=4;Megalodon=3;Basking shark=2;Nurse shark=2;Blue shark=1.5;Lemon shark=1.2;Thresher shark=1;Goblin shark=1;Greenland shark=0.8;Blacktip shark|Blacktip reef=0.8;Oceanic whitetip shark|Whitetip|Whitetip reef=0.7;Wobbegong;Angel shark|Angelshark;Sixgill shark|Bluntnose sixgill;Cookiecutter shark;Frilled shark;Megamouth shark;Porbeagle shark;Dogfish|Spiny dogfish;Bamboo shark;Leopard shark;Zebra shark;Horn shark;Sand tiger shark;Silky shark;Dusky shark;Sandbar shark;Salmon shark;Lantern shark;Carpet shark;Epaulette shark;Sawshark|Saw;Bonnethead;Catshark|Cat;Sleeper shark;Port Jackson shark;Galápagos shark|Galapagos;Grey reef shark|Gray reef|Reef`,
  },
  {
    id: 'ani-bird-of-prey', topic: 'animals', difficulty: 2, text: 'Name a bird of prey',
    answers: `Eagle|Bald eagle|Golden eagle|Harpy eagle|Sea eagle=35;Hawk|Red-tailed hawk=18;Falcon|Peregrine falcon|Peregrine|Gyrfalcon=14;Owl|Barn owl|Snowy owl|Eagle owl=10;Vulture|Bearded vulture|Lammergeier=6;Osprey=3;Kite|Red kite=2;Condor|Andean condor|California condor=2;Buzzard=2;Kestrel=1.5;Harrier=1;Secretary bird=0.8;Caracara=0.6;Goshawk=0.6;Sparrowhawk;Hobby;Merlin`,
  },

  // ───────────── Food ─────────────
  {
    id: 'food-pasta', topic: 'food', difficulty: 1, text: 'Name a type of pasta',
    answers: `Spaghetti=30;Penne=18;Fusilli=8;Lasagne|Lasagna=8;Macaroni=7;Tagliatelle=5;Farfalle|Bow tie|Bowtie=5;Linguine=4;Ravioli=4;Rigatoni=3;Fettuccine|Fettucine|Fettuccini=3;Tortellini=2.5;Gnocchi=1.5;Orzo=1.2;Conchiglie|Shells=1;Cannelloni=1;Pappardelle=1;Orecchiette=0.8;Bucatini=0.6;Vermicelli=0.6;Ziti=0.6;Capellini|Angel hair=0.6;Cavatappi;Ditalini;Gemelli;Paccheri;Radiatori;Rotini;Campanelle;Casarecce;Cavatelli;Strozzapreti;Trofie;Mafaldine;Bigoli;Agnolotti;Cappelletti;Mezzelune;Fregola;Stelline;Anelli;Lumache;Tortiglioni;Calamarata;Garganelli;Spaghettini;Tagliolini|Taglierini;Manicotti;Pici`,
  },
  {
    id: 'food-citrus', topic: 'food', difficulty: 1, text: 'Name a citrus fruit',
    answers: `Orange=35;Lemon=25;Lime=15;Grapefruit=8;Mandarin=5;Tangerine=4;Clementine=3;Pomelo|Pummelo=1.2;Kumquat=1;Yuzu=1;Blood orange=0.8;Satsuma=0.6;Bergamot=0.5;Citron=0.4;Key lime;Finger lime;Calamansi|Calamondin;Ugli fruit|Ugli;Sudachi;Makrut lime|Kaffir lime;Bitter orange|Seville orange;Tangelo;Minneola;Dekopon|Sumo citrus;Etrog;Buddha’s hand`,
  },
  {
    id: 'food-spice', topic: 'food', difficulty: 2, text: 'Name a spice',
    answers: `Cinnamon=20;Pepper|Black pepper=15;Paprika=8;Cumin=8;Turmeric=7;Chilli|Chili|Chile|Chili powder|Chilli powder=6;Ginger=5;Nutmeg=5;Saffron=4;Cloves|Clove=3;Cardamom|Cardamon=3;Coriander|Coriander seed=2;Star anise=1.5;Cayenne|Cayenne pepper=1.2;Allspice=1;Vanilla=1;Fennel|Fennel seed=1;Mustard seed|Mustard=0.8;Sumac=0.8;Fenugreek=0.6;Anise|Aniseed=0.5;White pepper;Caraway;Mace;Asafoetida|Hing;Juniper|Juniper berries;Nigella|Nigella seed|Kalonji;Sichuan pepper|Szechuan pepper;Annatto;Galangal;Grains of paradise;Long pepper;Pink peppercorn;Celery seed;Ajwain;Dill seed;Poppy seed`,
  },
  {
    id: 'food-japanese', topic: 'food', difficulty: 3, text: 'Name a Japanese dish',
    answers: `Sushi=35;Ramen=22;Tempura=8;Sashimi=7;Udon=5;Miso soup|Miso=4;Teriyaki=3;Gyoza=3;Katsu|Tonkatsu|Katsu curry|Chicken katsu=2.5;Yakitori=2;Okonomiyaki=1.5;Takoyaki=1.5;Onigiri=1.2;Soba=1.2;Edamame=1;Mochi=1;Donburi|Katsudon|Gyudon|Oyakodon=0.8;Sukiyaki=0.6;Shabu-shabu=0.6;Bento=0.6;Japanese curry|Kare raisu|Curry rice=0.5;Nikujaga;Karaage;Tamagoyaki;Natto;Unagi|Unadon;Chawanmushi;Oden;Yakisoba;Omurice;Taiyaki;Dango;Dorayaki;Nabe;Tsukemen;Hiyashi chuka;Agedashi tofu;Ochazuke;Korokke;Yakiniku;Monjayaki;Sunomono;Tsukemono;Karē pan|Kare pan|Curry bread`,
  },
  {
    id: 'food-nut', topic: 'food', difficulty: 1, text: 'Name a type of nut', suffix: 'nut',
    answers: `Almond|Marcona almond=22;Peanut=18;Walnut=15;Cashew=12;Pistachio=8;Hazelnut|Filbert=7;Pecan=5;Macadamia=4;Brazil nut=3;Pine nut|Pignoli=1.5;Chestnut=1.5;Coconut=0.8;Acorn=0.6;Kola nut|Cola;Candlenut;Tiger nut;Betel nut|Areca;Beechnut|Beech;Butternut;Hickory;Pili nut;Baru nut;Ginkgo nut|Gingko;Mongongo nut;Shea nut;Kukui nut`,
  },

  // ───────────── Nature ─────────────
  {
    id: 'nat-gemstone', topic: 'nature', difficulty: 2, text: 'Name a gemstone',
    answers: `Diamond=30;Ruby=20;Emerald=15;Sapphire=12;Amethyst=5;Topaz=3;Opal=3;Pearl=2;Jade=2;Garnet=1.5;Aquamarine=1.2;Turquoise=1;Onyx=0.8;Amber=0.6;Peridot=0.6;Tanzanite=0.5;Lapis lazuli|Lapis=0.5;Moonstone=0.5;Citrine=0.5;Tourmaline;Alexandrite;Morganite;Spinel;Zircon;Jasper;Agate;Malachite;Obsidian;Carnelian;Bloodstone;Beryl;Quartz|Rose quartz;Labradorite;Kunzite;Iolite;Tiger’s eye|Tigers eye;Chrysoprase;Sunstone;Coral;Jet;Rhodochrosite;Sodalite;Benitoite;Taaffeite;Painite;Chalcedony;Heliodor;Chrysoberyl;Fluorite`,
  },
  {
    id: 'nat-cloud', topic: 'nature', difficulty: 3, text: 'Name a type of cloud', suffix: 'cloud',
    answers: `Cumulus=30;Cirrus=18;Stratus=15;Cumulonimbus=10;Nimbus=6;Nimbostratus=4;Stratocumulus=3;Altostratus=2;Altocumulus=2;Cirrostratus=1.5;Cirrocumulus=1.2;Lenticular|Altocumulus lenticularis=1;Mammatus=0.8;Noctilucent=0.5;Shelf cloud;Wall cloud;Funnel cloud;Arcus;Pileus|Cap;Asperitas;Kelvin-Helmholtz|Fluctus;Pyrocumulus|Flammagenitus;Contrail;Nacreous|Polar stratospheric;Congestus|Cumulus congestus;Castellanus;Fractus|Scud;Virga;Roll cloud|Volutus;Morning Glory;Mackerel sky`,
  },
  {
    id: 'nat-tree', topic: 'nature', difficulty: 1, text: 'Name a type of tree', suffix: 'tree',
    answers: `Oak=28;Pine=18;Maple=10;Birch=6;Palm=5;Willow=4;Apple=3;Cherry=2;Beech=2;Ash=2;Elm=2;Redwood|Sequoia|Giant sequoia=2;Fir|Douglas fir=2;Spruce=1.5;Cedar=1.5;Olive=1.5;Eucalyptus|Gum=1.2;Baobab=1;Sycamore=1;Cypress=1;Chestnut=0.8;Poplar=0.8;Yew=0.8;Magnolia=0.7;Linden|Lime=0.6;Larch=0.5;Hazel;Alder;Aspen;Hawthorn;Rowan|Mountain ash;Juniper;Hemlock;Banyan;Fig;Mango;Teak;Mahogany;Ebony;Acacia;Jacaranda;Ginkgo;Sassafras;Hickory;Walnut;Plane tree;Hornbeam;Holly;Dogwood;Cottonwood;Joshua tree;Dragon blood tree;Monkey puzzle;Pear;Plum;Lemon;Orange;Coconut;Cork oak;Sandalwood;Rubber`,
  },

  // ───────────── History ─────────────
  {
    id: 'his-roman-emperor', topic: 'history', difficulty: 3, text: 'Name a Roman emperor',
    answers: `Augustus|Octavian=25;Nero=22;Caligula=12;Marcus Aurelius=8;Constantine|Constantine the Great|Constantine I=6;Trajan=4;Hadrian=4;Tiberius=3;Claudius=3;Commodus=3;Vespasian=1.5;Titus=1;Diocletian=1;Domitian=1;Septimius Severus=0.8;Caracalla=0.8;Justinian|Justinian I=0.6;Antoninus Pius=0.5;Nerva;Galba;Otho;Vitellius;Lucius Verus;Pertinax;Didius Julianus;Geta;Macrinus;Elagabalus|Heliogabalus;Severus Alexander|Alexander Severus;Maximinus Thrax;Gordian|Gordian I|Gordian II|Gordian III;Philip the Arab;Decius;Valerian;Gallienus;Claudius Gothicus;Aurelian;Probus;Carus;Maximian;Galerius;Constantius|Constantius Chlorus|Constantius II;Licinius;Julian|Julian the Apostate;Jovian;Valentinian;Valens;Theodosius|Theodosius I;Honorius;Arcadius;Romulus Augustulus;Majorian;Constans;Gratian`,
  },
  {
    id: 'his-us-president', topic: 'history', difficulty: 2, text: 'Name a US president',
    answers: `Abraham Lincoln|Lincoln=22;George Washington|Washington=20;Barack Obama|Obama=12;Donald Trump|Trump=10;John F. Kennedy|JFK|Kennedy|John Kennedy=8;Joe Biden|Biden=5;Franklin D. Roosevelt|FDR|Franklin Roosevelt|Roosevelt=4;Ronald Reagan|Reagan=3;Thomas Jefferson|Jefferson=3;Theodore Roosevelt|Teddy Roosevelt=2.5;Bill Clinton|Clinton=2;George W. Bush|George Bush|Bush|Bush Jr|Dubya=2;Richard Nixon|Nixon=2;Jimmy Carter|Carter=1.2;John Adams|Adams=1;Andrew Jackson|Jackson=1;Ulysses S. Grant|Grant|Ulysses Grant=1;George H. W. Bush|George HW Bush|Bush Sr|George Bush Sr=0.9;Dwight D. Eisenhower|Eisenhower|Ike|Dwight Eisenhower=0.9;Harry S. Truman|Truman|Harry Truman=0.8;Lyndon B. Johnson|LBJ|Lyndon Johnson|Johnson=0.8;Gerald Ford|Ford=0.7;James Madison|Madison;James Monroe|Monroe;John Quincy Adams;Martin Van Buren|Van Buren;William Henry Harrison|Harrison;John Tyler|Tyler;James K. Polk|Polk|James Polk;Zachary Taylor|Taylor;Millard Fillmore|Fillmore;Franklin Pierce|Pierce;James Buchanan|Buchanan;Andrew Johnson;Rutherford B. Hayes|Hayes;James A. Garfield|Garfield|James Garfield;Chester A. Arthur|Arthur|Chester Arthur;Grover Cleveland|Cleveland;Benjamin Harrison;William McKinley|McKinley;William Howard Taft|Taft;Woodrow Wilson|Wilson;Warren G. Harding|Harding;Calvin Coolidge|Coolidge;Herbert Hoover|Hoover`,
  },
  {
    id: 'his-greek-philosopher', topic: 'history', difficulty: 2, text: 'Name a philosopher of ancient Greece',
    answers: `Socrates=35;Plato=25;Aristotle=20;Pythagoras=5;Diogenes=3;Epicurus=2;Heraclitus=1.5;Democritus=1.2;Zeno|Zeno of Elea|Zeno of Citium=1;Thales|Thales of Miletus=1;Parmenides=0.8;Anaximander=0.6;Empedocles=0.6;Protagoras=0.5;Anaxagoras;Anaximenes;Xenophanes;Gorgias;Antisthenes;Hypatia;Plotinus;Epictetus;Chrysippus;Cleanthes;Theophrastus;Pyrrho;Aristippus;Leucippus;Hippias;Prodicus`,
  },
  {
    id: 'his-ancient-wonder', topic: 'history', difficulty: 2, text: 'Name a Wonder of the Ancient World',
    answers: `Great Pyramid of Giza|Great Pyramid|Pyramids of Giza|Pyramid of Giza|Pyramids|Pyramid|Giza=40;Hanging Gardens of Babylon|Hanging Gardens=20;Colossus of Rhodes|Colossus=12;Lighthouse of Alexandria|Pharos of Alexandria|Pharos=10;Statue of Zeus at Olympia|Statue of Zeus=8;Temple of Artemis at Ephesus|Temple of Artemis=4;Mausoleum at Halicarnassus|Mausoleum of Halicarnassus|Mausoleum=0.8`,
  },

  // ───────────── Science ─────────────
  {
    id: 'sci-element', topic: 'science', difficulty: 1, text: 'Name a chemical element',
    answers: `Oxygen=18;Hydrogen=14;Carbon=10;Gold=8;Iron=6;Helium=5;Nitrogen=4;Silver=3;Sodium=2;Copper=2;Calcium=2;Neon=1.5;Lithium=1.5;Uranium=1.5;Aluminium|Aluminum=1.2;Potassium=1.2;Zinc=1;Lead=1;Chlorine=1;Mercury=1;Magnesium=1;Platinum=1;Sulfur|Sulphur=0.9;Titanium=0.8;Silicon=0.8;Plutonium=0.7;Tin=0.7;Phosphorus=0.6;Fluorine=0.5;Nickel=0.5;Beryllium;Boron;Argon;Scandium;Vanadium;Chromium;Manganese;Cobalt;Gallium;Germanium;Arsenic;Selenium;Bromine;Krypton;Rubidium;Strontium;Yttrium;Zirconium;Niobium;Molybdenum;Technetium;Ruthenium;Rhodium;Palladium;Cadmium;Indium;Antimony;Tellurium;Iodine;Xenon;Caesium|Cesium;Barium;Lanthanum;Cerium;Praseodymium;Neodymium;Promethium;Samarium;Europium;Gadolinium;Terbium;Dysprosium;Holmium;Erbium;Thulium;Ytterbium;Lutetium;Hafnium;Tantalum;Tungsten|Wolfram;Rhenium;Osmium;Iridium;Thallium;Bismuth;Polonium;Astatine;Radon;Francium;Radium;Actinium;Thorium;Protactinium;Neptunium;Americium;Curium;Berkelium;Californium;Einsteinium;Fermium;Mendelevium;Nobelium;Lawrencium;Rutherfordium;Dubnium;Seaborgium;Bohrium;Hassium;Meitnerium;Darmstadtium;Roentgenium;Copernicium;Nihonium;Flerovium;Moscovium;Livermorium;Tennessine;Oganesson`,
  },
  {
    id: 'sci-planet', topic: 'science', difficulty: 1, text: 'Name a planet or dwarf planet in our solar system',
    answers: `Mars=26;Jupiter=16;Earth=14;Saturn=12;Venus=8;Pluto=8;Mercury=6;Neptune=5;Uranus=4;Ceres=1.2;Eris=0.6;Makemake=0.3;Haumea=0.3`,
  },
  {
    id: 'sci-bone', topic: 'science', difficulty: 2, text: 'Name a bone in the human body',
    answers: `Femur|Thigh bone=22;Skull|Cranium=12;Rib|Rib cage|Ribcage=10;Tibia|Shin bone|Shinbone=8;Fibula=5;Humerus=5;Spine|Vertebra|Vertebrae|Backbone=5;Pelvis|Hip bone|Hip=4;Radius=3;Ulna=3;Jaw|Jawbone|Mandible=3;Clavicle|Collarbone=2.5;Patella|Kneecap=2;Scapula|Shoulder blade=1.5;Sternum|Breastbone=1.2;Coccyx|Tailbone=1;Stapes|Stirrup=1;Phalanges|Phalanx=0.6;Hyoid;Sacrum;Maxilla;Incus|Anvil;Malleus|Hammer;Metacarpal;Metatarsal;Carpal;Tarsal;Calcaneus|Heel bone;Talus;Scaphoid;Lunate;Hamate;Pisiform;Trapezium;Trapezoid;Capitate;Triquetrum;Cuboid;Navicular;Cuneiform;Ethmoid;Sphenoid;Occipital;Parietal;Temporal;Frontal;Zygomatic|Cheekbone;Nasal;Lacrimal;Vomer;Palatine;Ilium;Ischium;Pubis`,
  },
  {
    id: 'sci-organ', topic: 'science', difficulty: 1, text: 'Name an organ in the human body',
    answers: `Heart=30;Brain=18;Liver=10;Lung|Lungs=10;Kidney=8;Stomach=6;Skin=4;Intestine|Small intestine|Large intestine|Colon|Bowel|Gut=3;Pancreas=2;Spleen=1.5;Gallbladder|Gall bladder=1.2;Bladder|Urinary bladder=1.2;Appendix=1;Thyroid|Thyroid gland=1;Eye=1;Tongue=0.6;Uterus|Womb=0.6;Ovary|Ovaries=0.5;Oesophagus|Esophagus=0.5;Prostate;Testicle|Testes|Testis;Adrenal gland|Adrenal;Pituitary gland|Pituitary;Thymus;Pineal gland|Pineal;Larynx|Voice box;Trachea|Windpipe;Diaphragm;Ear;Nose;Tonsil;Duodenum;Rectum;Placenta`,
  },
  {
    id: 'sci-constellation', topic: 'science', difficulty: 3, text: 'Name a constellation',
    answers: `Orion=28;Ursa Major|Great Bear|Big Dipper|Plough|The Plough=15;Cassiopeia=8;Ursa Minor|Little Bear|Little Dipper=5;Scorpius|Scorpio=4;Leo=4;Taurus=3;Gemini=3;Andromeda=3;Cygnus|Swan=2;Pegasus=2;Draco=2;Aries=2;Sagittarius=1.5;Libra=1;Virgo=1;Cancer=1;Capricornus|Capricorn=1;Aquarius=1;Pisces=1;Crux|Southern Cross=1;Lyra=0.8;Perseus=0.8;Hercules=0.8;Canis Major=0.8;Aquila=0.6;Centaurus=0.6;Antlia;Apus;Ara;Auriga;Boötes|Bootes;Caelum;Camelopardalis;Canes Venatici;Canis Minor;Carina;Cepheus;Cetus;Chamaeleon;Circinus;Columba;Coma Berenices;Corona Australis;Corona Borealis;Corvus;Crater;Delphinus;Dorado;Equuleus;Eridanus;Fornax;Grus;Horologium;Hydra;Hydrus;Indus;Lacerta;Leo Minor;Lepus;Lupus;Lynx;Mensa;Microscopium;Monoceros;Musca;Norma;Octans;Ophiuchus;Pavo;Phoenix;Pictor;Piscis Austrinus;Puppis;Pyxis;Reticulum;Sagitta;Sculptor;Scutum;Serpens;Sextans;Telescopium;Triangulum;Triangulum Australe;Tucana;Vela;Volans;Vulpecula`,
  },
  {
    id: 'sci-noble-gas', topic: 'science', difficulty: 2, text: 'Name a noble gas',
    answers: `Helium=38;Neon=28;Argon=15;Xenon=7;Krypton=7;Radon=4;Oganesson=0.5`,
  },

  // ───────────── Culture ─────────────
  {
    id: 'cul-shakespeare', topic: 'culture', difficulty: 2, text: 'Name a play by Shakespeare',
    answers: `Romeo and Juliet=32;Hamlet=22;Macbeth=14;Othello=6;A Midsummer Night’s Dream|Midsummer Night’s Dream|Midsummer Nights Dream=6;King Lear=5;Julius Caesar=4;The Tempest=3;Much Ado About Nothing=2;Twelfth Night=2;The Merchant of Venice=2;The Taming of the Shrew=1.5;As You Like It=1;Richard III|Richard 3|Richard the Third=1;Antony and Cleopatra=0.8;Henry V|Henry 5|Henry the Fifth=0.8;The Winter’s Tale;Coriolanus;Titus Andronicus;Measure for Measure;All’s Well That Ends Well;The Comedy of Errors;Love’s Labour’s Lost|Loves Labours Lost;The Two Gentlemen of Verona;The Merry Wives of Windsor;Troilus and Cressida;Timon of Athens;Pericles;Cymbeline;King John;Richard II|Richard 2;Henry IV|Henry 4;Henry VI|Henry 6;Henry VIII|Henry 8;The Two Noble Kinsmen`,
  },
  {
    id: 'cul-greek-god', topic: 'culture', difficulty: 1, text: 'Name a Greek god or goddess',
    answers: `Zeus=35;Poseidon=14;Athena|Athene=10;Hades=10;Aphrodite=7;Apollo=6;Ares=4;Hermes=4;Hera=3;Artemis=2.5;Dionysus|Dionysos=1.5;Hephaestus|Hephaistos=1;Demeter=1;Persephone=1;Nike=0.8;Eros=0.7;Hestia=0.6;Gaia|Gaea=0.5;Pan;Hecate|Hekate;Nemesis;Helios;Selene;Eos;Iris;Hypnos;Thanatos;Tyche;Nyx;Asclepius|Asklepios;Morpheus;Hebe;Triton;Kronos|Cronus;Uranus|Ouranos;Rhea;Eris;Boreas;Aeolus;Hymenaios|Hymen`,
  },
  {
    id: 'cul-orchestra', topic: 'culture', difficulty: 2, text: 'Name an instrument in a symphony orchestra',
    answers: `Violin=35;Cello|Violoncello=12;Flute=8;Trumpet=7;Piano=5;Clarinet=4;Double bass|Contrabass|Upright bass|Bass=4;Viola=3;Oboe=3;Trombone=3;French horn|Horn=3;Harp=2.5;Timpani|Kettle drum|Kettledrums=2;Tuba=2;Bassoon=1.5;Percussion|Drum|Drums=1.5;Piccolo=1;Cymbals|Cymbal=1;Triangle=1;Snare drum|Snare=0.8;Bass drum=0.6;Xylophone=0.6;Glockenspiel=0.5;Celesta|Celeste;Cor anglais|English horn;Contrabassoon|Double bassoon;Bass clarinet;Tubular bells|Chimes;Tam-tam|Gong;Castanets;Tambourine;Marimba;Vibraphone;Organ|Pipe organ;Saxophone|Sax;Harpsichord;Euphonium;Wagner tuba;Cornet;Bass trombone;Wood block;Whip|Slapstick`,
  },
  {
    id: 'cul-paris-2024', topic: 'culture', difficulty: 2, text: 'Name a sport at the Paris 2024 Olympics',
    answers: `Swimming=22;Athletics|Track and field|Running|Sprinting=14;Gymnastics|Artistic gymnastics=12;Football|Soccer=6;Basketball=6;Tennis=4;Boxing=3;Volleyball=3;Cycling|BMX|Mountain biking|Track cycling|Road cycling=3;Fencing=2;Rowing=2;Diving=2;Judo=1.5;Wrestling=1.5;Archery=1.5;Weightlifting=1.2;Table tennis|Ping pong=1.2;Equestrian|Dressage|Show jumping|Eventing=1;Hockey|Field hockey=1;Sailing=1;Breaking|Breakdancing=1;Skateboarding=1;Surfing=0.8;Badminton=0.8;Taekwondo=0.8;Handball=0.8;Golf=0.8;Shooting=0.7;Triathlon=0.7;Rugby sevens|Rugby=0.7;Water polo=0.6;Canoeing|Canoe|Kayaking|Kayak=0.6;Beach volleyball=0.6;Sport climbing|Climbing=0.6;Trampoline|Trampolining=0.5;Modern pentathlon|Pentathlon=0.4;Artistic swimming|Synchronised swimming|Synchronized swimming=0.4;Marathon swimming|Open water swimming=0.3;Rhythmic gymnastics;3x3 basketball`,
  },

  // ───────────── General knowledge ─────────────
  {
    id: 'gen-currency', topic: 'general', difficulty: 2, text: 'Name a currency used today',
    answers: `Dollar|US dollar|USD|American dollar=28;Euro=27;Pound|Pound sterling|British pound|Sterling|GBP=12;Yen|Japanese yen=10;Peso=4;Rupee|Indian rupee=4;Yuan|Renminbi|RMB|Chinese yuan=3;Franc|Swiss franc=2;Ruble|Rouble=2;Won=1.5;Dirham=1;Real|Brazilian real=1;Krone=0.8;Krona=0.8;Lira|Turkish lira=0.8;Rand=0.8;Shekel=0.6;Złoty|Zloty=0.6;Forint;Baht;Dinar;Riyal;Rial;Ringgit;Rupiah;Dong;Naira;Shilling;Kwacha;Hryvnia;Lari;Dram;Tenge;Leu;Lev;Lek;Koruna;Taka;Kyat;Kip;Riel;Cedi;Birr;Dalasi;Quetzal;Colón|Colon;Sol;Boliviano;Guaraní|Guarani;Bolívar|Bolivar;Lempira;Córdoba|Cordoba;Manat;Som;Afghani;Tögrög|Tugrik;Pula;Loti;Ariary;Ouguiya;Kina;Vatu;Tala;Denar;Convertible mark;Somoni`,
  },
  {
    id: 'gen-greek-letter', topic: 'general', difficulty: 2, text: 'Name a letter of the Greek alphabet',
    answers: `Alpha=30;Beta=15;Pi=10;Omega=10;Delta=8;Gamma=6;Sigma=5;Lambda=3;Theta=2.5;Epsilon=2;Mu=1.5;Phi=1.5;Psi=1;Zeta=1;Omicron=1;Tau=0.9;Kappa=0.9;Chi=0.8;Rho=0.6;Eta=0.6;Iota=0.6;Xi=0.5;Nu=0.5;Upsilon=0.5`,
  },
  {
    id: 'gen-nato', topic: 'general', difficulty: 3, text: 'Name a word from the NATO phonetic alphabet',
    answers: `Alpha|Alfa=20;Bravo=15;Charlie=15;Delta=10;Echo=6;Foxtrot=5;Tango=4;Zulu=3;Romeo=3;Victor=2;Whiskey|Whisky=2;Oscar=2;Golf=1.5;Hotel=1.5;Sierra=1.2;Yankee=1.2;Kilo=1;Lima=1;Mike=1;India=1;Juliett|Juliet=0.8;Papa=0.8;Quebec=0.7;X-ray|Xray=0.7;November=0.6;Uniform=0.5`,
  },
  {
    id: 'gen-time-unit', topic: 'general', difficulty: 2, text: 'Name a unit of time',
    answers: `Second=25;Minute=20;Hour=15;Day=10;Year=8;Week=6;Month=5;Decade=3;Century=3;Millennium=2;Millisecond=1.5;Fortnight=1.2;Nanosecond=1;Microsecond=0.8;Aeon|Eon=0.6;Era=0.5;Epoch;Picosecond;Femtosecond;Attosecond;Zeptosecond;Yoctosecond;Jiffy;Shake;Planck time;Sol;Olympiad;Lustrum;Sidereal day;Kalpa`,
  },
];
