import os

def convert_to_utf8(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Check for UTF-16LE BOM or null bytes
        if content.startswith(b'\xff\xfe') or b'\x00' in content:
            print(f"Converting {filepath} to UTF-8...")
            # Try to decode from UTF-16LE
            try:
                decoded = content.decode('utf-16')
            except UnicodeDecodeError:
                # If that fails, it might just be null bytes in UTF-8
                decoded = content.replace(b'\x00', b'').decode('utf-8', errors='ignore')
                
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(decoded)
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

for root, dirs, files in os.walk('.'):
    for name in files:
        if name.endswith('.py'):
            convert_to_utf8(os.path.join(root, name))
