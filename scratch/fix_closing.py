with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

bad = '''                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>'''

good = '''                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </main>'''

text = text.replace(bad, good, 1)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Corrected closing braces')

