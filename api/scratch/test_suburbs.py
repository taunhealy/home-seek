import requests

def test_suburbs():
    try:
        # Assuming the local API is running on port 8000
        response = requests.get("http://localhost:8000/geofence/suburbs")
        if response.status_code == 200:
            suburbs = response.json()
            print(f"Total suburbs: {len(suburbs)}")
            if "Meadowridge" in suburbs:
                print("Meadowridge FOUND")
            else:
                print("Meadowridge NOT FOUND")
            print("First 10 suburbs:", suburbs[:10])
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_suburbs()
