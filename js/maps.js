/* Shared MapLibre engine for corridor sequence + beer-Xili map.
 * Approximate coordinates — schematic for briefing, not surveyed GIS.
 */
(function () {
  const ESRI = {
    tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri',
    tileSize: 256, maxzoom: 19
  };
  // Fallback GCJ-02 satellite if Esri blocked in-room
  const AMAP_SAT = {
    tiles: [1,2,3,4].map(n => `https://webst0${n}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`),
    attribution: '© AutoNavi',
    tileSize: 256, maxzoom: 18,
    // Note: Amap tiles are GCJ-02; overlay approx. Accept minor offset for briefing.
  };

  // Approximate georeference of image16 masterplan plate over Bao'an corridor.
  // Extends satellite east of Jiangangshan beyond the plate.
  const MASTER_BOUNDS = {
    /* Approx image16 plate over corridor; satellite extends east past 尖岗山 toward 留仙洞/西丽.
     * Soft CSS mask + lower east opacity lets live Esri show through. */
    coordinates: [
      [113.865, 22.595], // TL
      [113.950, 22.595], // TR — plate ends; live sat continues east
      [113.950, 22.530], // BR
      [113.865, 22.530]  // BL
    ]
  };

  const CAMERAS = {
    // From research/map-coords.md (WGS84)
    overview:   { center: [113.91, 22.575], zoom: 12.2, pitch: 45, bearing: -20 },
    baozhong:   { center: [113.885, 22.548], zoom: 14.0, pitch: 40, bearing: -18 },
    harbor:     { center: [113.885, 22.545], zoom: 14.6, pitch: 35, bearing: -16 },
    lingzhi:    { center: [113.8992, 22.5720], zoom: 14.2, pitch: 40, bearing: -15 },
    jiangang:   { center: [113.9150, 22.5830], zoom: 13.8, pitch: 40, bearing: 10 },
  };

  // Schematic enterprise clusters for 具身智能港 (from image17 legend categories).
  // Approx coords clustered around Baozhong / coastal corridor — NOT exact addresses.
  const ENTERPRISES = [
    /* Schematic clusters around 具身智能港 approx center [113.885, 22.545]
     * (~23 km² policy zone). NOT geocoded company addresses. Categories from image17. */
    { name: '优必选', cat: '本体企业', lng: 113.878, lat: 22.548 },
    { name: '节卡机器人', cat: '本体企业', lng: 113.882, lat: 22.542 },
    { name: '傅利叶', cat: '本体企业', lng: 113.888, lat: 22.540 },
    { name: '银河通用', cat: '本体企业', lng: 113.891, lat: 22.546 },
    { name: '海柔创新', cat: '本体企业', lng: 113.885, lat: 22.538 },
    { name: '慧灵科技', cat: '本体企业', lng: 113.893, lat: 22.550 },
    { name: '横川机器人', cat: '本体企业', lng: 113.876, lat: 22.544 },
    { name: '零一云控', cat: '本体企业', lng: 113.880, lat: 22.552 },
    { name: '思谋科技', cat: '数据服务', lng: 113.887, lat: 22.536 },
    { name: '途见科技', cat: '数据服务', lng: 113.894, lat: 22.542 },
    { name: '感知服务A', cat: '数据服务', lng: 113.883, lat: 22.550 },
    { name: '数据节点B', cat: '数据服务', lng: 113.896, lat: 22.547 },
    { name: '兆威机电', cat: '核心零部件', lng: 113.874, lat: 22.540 },
    { name: '大族智控', cat: '核心零部件', lng: 113.890, lat: 22.552 },
    { name: '核心部件B', cat: '核心零部件', lng: 113.892, lat: 22.535 },
    { name: '核心部件C', cat: '核心零部件', lng: 113.871, lat: 22.546 },
  ];
  const CAT_COLOR = {
    '本体企业': '#5cb88a',
    '数据服务': '#e08a3c',
    '核心零部件': '#d45a4a'
  };

  // Beer Town ↔ Liuxiandong / Xili Hub corridor (approx WGS84)
  const BEER = {
    // research/map-coords.md — prefer 西丽高铁站 ≈ 22.570, 113.940
    beerTown:   { lng: 113.9150, lat: 22.5830, label: '啤酒小镇 / 雪花科创城' },
    liuxian:    { lng: 113.9391, lat: 22.5834, label: '留仙洞总部基地' },
    xiliHub:    { lng: 113.9402, lat: 22.5700, label: '西丽枢纽（高铁）' },
    route: [
      [113.9150, 22.5830],
      [113.9220, 22.5850],
      [113.9300, 22.5845],
      [113.9391, 22.5834],
      [113.9402, 22.5700]
    ]
  };

  let sharedMap = null;
  let sharedReady = false;
  let beerMap = null;
  let markers = [];
  let basemapKind = 'esri';

  function styleFor(kind) {
    const src = kind === 'amap' ? AMAP_SAT : ESRI;
    return {
      version: 8,
      sources: {
        sat: {
          type: 'raster',
          tiles: src.tiles,
          tileSize: src.tileSize,
          maxzoom: src.maxzoom,
          attribution: src.attribution
        }
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
    };
  }

  function ensureShared() {
    if (sharedMap) return sharedMap;
    const el = document.getElementById('shared-map');
    if (!el || !window.maplibregl) return null;
    sharedMap = new maplibregl.Map({
      container: el,
      style: styleFor('esri'),
      center: CAMERAS.overview.center,
      zoom: CAMERAS.overview.zoom,
      pitch: 0,
      bearing: -4,
      attributionControl: true,
      maxPitch: 55
    });
    sharedMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    sharedMap.on('load', () => {
      sharedReady = true;
      addMasterOverlay();
      addDistrictRings();
      addEnterpriseLayer();
      setOverlayMode('overview');
      // If tiles fail silently, try amap once
      setTimeout(() => {
        try {
          const canvas = sharedMap.getCanvas();
          // no reliable empty-tile detect; leave Esri as default
        } catch (_) {}
      }, 2000);
    });
    sharedMap.on('error', (e) => {
      if (basemapKind === 'esri' && e && e.error) {
        // soft fallback
        basemapKind = 'amap';
        try { sharedMap.setStyle(styleFor('amap'));
          sharedMap.once('style.load', () => {
            addMasterOverlay(); addDistrictRings(); addEnterpriseLayer();
            setOverlayMode(window.__mapMode || 'overview');
          });
        } catch (_) {}
      }
    });
    return sharedMap;
  }

  function addMasterOverlay() {
    if (!sharedMap.getSource('masterplan')) {
      sharedMap.addSource('masterplan', {
        type: 'image',
        url: 'assets/image16-web.jpg',
        coordinates: MASTER_BOUNDS.coordinates
      });
      sharedMap.addLayer({
        id: 'masterplan',
        type: 'raster',
        source: 'masterplan',
        paint: {
          'raster-opacity': 0.82,
          'raster-fade-duration': 0
        }
      });
    }
  }

  function addDistrictRings() {
    const rings = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { id: 'baozhong' }, geometry: { type: 'Point', coordinates: [113.8823, 22.5576] } },
        { type: 'Feature', properties: { id: 'lingzhi' }, geometry: { type: 'Point', coordinates: [113.8992, 22.5720] } },
        { type: 'Feature', properties: { id: 'jiangang' }, geometry: { type: 'Point', coordinates: [113.9150, 22.5830] } }
      ]
    };
    if (!sharedMap.getSource('districts')) {
      sharedMap.addSource('districts', { type: 'geojson', data: rings });
      sharedMap.addLayer({
        id: 'district-glow',
        type: 'circle',
        source: 'districts',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            11, 40, 13, 70, 15, 110
          ],
          'circle-color': '#d4a84b',
          'circle-opacity': 0.08,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#d4a84b',
          'circle-stroke-opacity': 0.75
        }
      });
    }
  }

  function addEnterpriseLayer() {
    const fc = {
      type: 'FeatureCollection',
      features: ENTERPRISES.map(e => ({
        type: 'Feature',
        properties: { name: e.name, cat: e.cat, color: CAT_COLOR[e.cat] },
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] }
      }))
    };
    if (!sharedMap.getSource('enterprises')) {
      sharedMap.addSource('enterprises', { type: 'geojson', data: fc });
      sharedMap.addLayer({
        id: 'enterprises',
        type: 'circle',
        source: 'enterprises',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 4, 14, 7, 16, 10
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#0a0a0b',
          'circle-opacity': 0.92
        }
      });
      sharedMap.addLayer({
        id: 'enterprise-labels',
        type: 'symbol',
        source: 'enterprises',
        layout: {
          visibility: 'none',
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#f4f0e8',
          'text-halo-color': '#0a0a0b',
          'text-halo-width': 1.2
        }
      });
      sharedMap.on('click', 'enterprises', (e) => {
        const f = e.features[0];
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(f.geometry.coordinates)
          .setHTML(`<strong>${f.properties.name}</strong><br><span style="opacity:.7">${f.properties.cat}</span><br><span style="opacity:.45;font-size:10px">示意点位 · schematic</span>`)
          .addTo(sharedMap);
      });
      sharedMap.on('mouseenter', 'enterprises', () => { sharedMap.getCanvas().style.cursor = 'pointer'; });
      sharedMap.on('mouseleave', 'enterprises', () => { sharedMap.getCanvas().style.cursor = ''; });
    }
  }

  function setOverlayMode(mode) {
    window.__mapMode = mode;
    if (!sharedMap || !sharedReady) {
      const wait = () => {
        if (sharedReady) setOverlayMode(mode);
        else setTimeout(wait, 80);
      };
      wait();
      return;
    }
    const showMaster = mode === 'overview' || mode === 'baozhong' || mode === 'lingzhi' || mode === 'jiangang';
    const showEnterprises = mode === 'harbor';
    const showRings = mode === 'overview';
    if (sharedMap.getLayer('masterplan')) {
      sharedMap.setPaintProperty('masterplan', 'raster-opacity',
        mode === 'overview' ? 0.82 :
        mode === 'baozhong' ? 0.7 :
        mode === 'lingzhi' ? 0.72 :
        mode === 'jiangang' ? 0.68 : 0.15
      );
      sharedMap.setLayoutProperty('masterplan', 'visibility', showMaster || mode === 'harbor' ? 'visible' : 'none');
      if (mode === 'harbor') {
        sharedMap.setPaintProperty('masterplan', 'raster-opacity', 0.22);
      }
    }
    if (sharedMap.getLayer('district-glow')) {
      sharedMap.setLayoutProperty('district-glow', 'visibility', showRings ? 'visible' : 'none');
    }
    if (sharedMap.getLayer('enterprises')) {
      sharedMap.setLayoutProperty('enterprises', 'visibility', showEnterprises ? 'visible' : 'none');
      sharedMap.setLayoutProperty('enterprise-labels', 'visibility', showEnterprises ? 'visible' : 'none');
    }
  }

  function flyTo(mode, duration) {
    const cam = CAMERAS[mode] || CAMERAS.overview;
    ensureShared();
    const run = () => {
      setOverlayMode(mode);
      sharedMap.easeTo({
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        duration: duration == null ? 1400 : duration,
        easing: t => 1 - Math.pow(1 - t, 3)
      });
      sharedMap.resize();
    };
    if (sharedReady) run();
    else sharedMap.once('load', run);
  }

  function showShared(on) {
    const root = document.getElementById('shared-map-root');
    if (!root) return;
    if (on) {
      ensureShared();
      root.classList.add('is-on');
      requestAnimationFrame(() => { if (sharedMap) sharedMap.resize(); });
    } else {
      root.classList.remove('is-on');
    }
  }

  function initBeerMap() {
    const el = document.getElementById('beer-map');
    if (!el || !window.maplibregl || beerMap) {
      if (beerMap) { beerMap.resize(); return beerMap; }
      return null;
    }
    beerMap = new maplibregl.Map({
      container: el,
      style: styleFor('esri'),
      center: [113.930, 22.578],
      zoom: 12.9,
      pitch: 40,
      bearing: -10,
      attributionControl: true
    });
    beerMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    beerMap.on('load', () => {
      beerMap.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: BEER.route }
        }
      });
      beerMap.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#d4a84b',
          'line-width': 10,
          'line-opacity': 0.22,
          'line-blur': 4
        }
      });
      beerMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#7ec8e3',
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });

      const nodes = [
        { ...BEER.beerTown, color: '#d4a84b' },
        { ...BEER.liuxian, color: '#7ec8e3' },
        { ...BEER.xiliHub, color: '#d45a4a' }
      ];
      nodes.forEach(n => {
        const el = document.createElement('div');
        el.className = 'poi-marker';
        el.innerHTML = `<i style="background:${n.color}"></i><span>${n.label}</span>`;
        new maplibregl.Marker({ element: el, anchor: 'left' })
          .setLngLat([n.lng, n.lat])
          .addTo(beerMap);
      });

      // soft rings
      beerMap.addSource('nodes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: nodes.map(n => ({
            type: 'Feature',
            properties: { color: n.color },
            geometry: { type: 'Point', coordinates: [n.lng, n.lat] }
          }))
        }
      });
      beerMap.addLayer({
        id: 'node-rings',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 28,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.12,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.8
        }
      });
    });
    return beerMap;
  }

  // Inject marker CSS once
  const style = document.createElement('style');
  style.textContent = `
    .poi-marker { display:flex; align-items:center; gap:8px; pointer-events:none; }
    .poi-marker i { width:12px; height:12px; border-radius:50%; box-shadow:0 0 0 3px rgba(0,0,0,.45); flex:0 0 auto; }
    .poi-marker span {
      background: rgba(10,10,12,.82); color:#f4f0e8; border:1px solid rgba(212,168,75,.35);
      padding:5px 9px; font-size:12px; letter-spacing:.04em; white-space:nowrap;
      backdrop-filter: blur(8px);
    }
  `;
  document.head.appendChild(style);

  window.DeckMaps = {
    ensureShared, showShared, flyTo, setOverlayMode, initBeerMap, CAMERAS
  };
})();
