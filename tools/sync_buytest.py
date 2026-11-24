"""Copy the map page's app (map.html <main class="mapapp">) into buytest.html's <template id="map-view">,
so the test page's Map view always matches the map page. Run after editing map.html's markup."""
import re
mp = open("map.html").read(); bt = open("buytest.html").read()
a = mp.index('<main id="main" class="mapapp is-loading">'); b = mp.index("</main>", a)
app = mp[a:b].replace('<main id="main" class="mapapp is-loading">', '<div class="mapapp is-loading" data-mapview>', 1)
app = app.replace('<h1 class="visually-hidden">Property map</h1>', '<h2 class="visually-hidden">Property map</h2>', 1) + "</div>"
import re as _re
css = _re.search(r'assets/css/map\.css\?v=[^"]+', mp).group(0); js = _re.search(r'assets/js/map\.js\?v=[^"]+', mp).group(0)
bt = _re.sub(r'<template id="map-view"[^>]*>', f'<template id="map-view" data-map-css="{css}" data-map-js="{js}">', bt, 1)
s = bt.index('<template id="map-view"'); s = bt.index(">", s) + 1; e = bt.index("</template>", s)
open("buytest.html", "w").write(bt[:s] + "\n" + app + "\n" + bt[e:])
print("buytest.html map view synced from map.html")
