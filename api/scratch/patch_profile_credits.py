with open('c:/Ryoko/Projects/home-seek/api/main.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = """    effective_id = get_effective_user_id(user_id, dummy_uid)
    profile = await get_user_profile(effective_id)
    return {**profile, "id": user_id}"""

replacement = """    effective_id = get_effective_user_id(user_id, dummy_uid)
    profile = await get_user_profile(effective_id)
    if "pro_credits" not in profile:
        profile["pro_credits"] = 5
    return {**profile, "id": user_id}"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/api/main.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print("SUCCESS")
else:
    print("NOT FOUND")

