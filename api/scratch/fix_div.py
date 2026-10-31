with open(r'c:\Ryoko\Projects\home-seek\web\src\app\reports\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = """                        <ListDashes size={14} weight="bold" />
                        <span>Table View</span>
                      </button>
                    </div>
                  </div>"""

if target not in c:
    target = target.replace('\n', '\r\n')

if target not in c:
    print("Could not find target, inspecting around line 680...")
else:
    nl = '\r\n' if '\r\n' in c else '\n'
    replacement = target + nl + '                  </div>'
    c = c.replace(target, replacement, 1)
    with open(r'c:\Ryoko\Projects\home-seek\web\src\app\reports\page.tsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Successfully added closing div!")

