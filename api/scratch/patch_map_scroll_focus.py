import sys

path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add isMapActive & showScrollHint states
old_states = """  const [showNoiseRadar, setShowNoiseRadar] = useState(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);"""

new_states = """  const [showNoiseRadar, setShowNoiseRadar] = useState(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);

  // Click-to-activate map focus (prevents page scroll hijacking)
  const [isMapActive, setIsMapActive] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Outside click listener to deactivate map focus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMapActive(false);
        setShowScrollHint(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("SUCCESS: Added isMapActive state and listener.")
else:
    print("WARNING: old_states not found.")

# 2. Update handleWheel logic
old_wheel = """  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 1, 18));
    } else {
      setZoom((z) => Math.max(z - 1, 9));
    }
  };"""

new_wheel = """  // Wheel zoom - only zooms if user has explicitly clicked into the map
  const handleWheel = (e: React.WheelEvent) => {
    if (!isMapActive) {
      // Don't intercept scroll; allow smooth page scrolling
      setShowScrollHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setShowScrollHint(false), 1600);
      return;
    }

    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 1, 18));
    } else {
      setZoom((z) => Math.max(z - 1, 9));
    }
  };"""

if old_wheel in content:
    content = content.replace(old_wheel, new_wheel)
    print("SUCCESS: Updated handleWheel logic.")
else:
    print("WARNING: old_wheel not found.")

# 3. Update main div handlers
old_div = """    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >"""

new_div = """    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 transition-shadow duration-200 ${
        isMapActive
          ? 'cursor-grab active:cursor-grabbing ring-2 ring-indigo-500/25'
          : 'cursor-pointer'
      } ${className}`}
      onClick={() => {
        setIsMapActive(true);
        setShowScrollHint(false);
      }}
      onMouseDown={(e) => {
        setIsMapActive(true);
        setShowScrollHint(false);
        handleMouseDown(e);
      }}
      onMouseLeave={() => {
        setIsMapActive(false);
        setShowScrollHint(false);
      }}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/* Scroll Hint Overlay (informs user that clicking activates zoom) */}
      {showScrollHint && !isMapActive && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md text-white text-[11px] font-bold shadow-xl border border-white/20 flex items-center gap-1.5">
            <NavigationArrow size={12} weight="bold" className="text-emerald-400" />
            <span>Click map to control zoom</span>
          </div>
        </div>
      )}"""

if old_div in content:
    content = content.replace(old_div, new_div)
    print("SUCCESS: Updated container div and added scroll hint.")
else:
    print("WARNING: old_div not found.")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch complete.")

