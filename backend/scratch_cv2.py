import cv2
import numpy as np
import urllib.request

def test():
    # Download a sample manga page
    url = "https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg"
    # Actually, downloading a real manga page is hard without a known URL.
    # Let's create a dummy manga page image using numpy
    img = np.ones((1000, 700, 3), dtype=np.uint8) * 255
    # Draw some black borders
    cv2.rectangle(img, (50, 50), (650, 300), (0,0,0), 5)
    cv2.rectangle(img, (50, 350), (300, 600), (0,0,0), 5)
    cv2.rectangle(img, (350, 350), (650, 600), (0,0,0), 5)
    cv2.rectangle(img, (50, 650), (650, 950), (0,0,0), 5)
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    kernel = np.ones((7, 7), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Try RETR_TREE
    contours, hierarchy = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    total_area = img.shape[0] * img.shape[1]
    valid_boxes = []
    
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if (0.015 * total_area) < area < (0.90 * total_area):
            # Check for duplicates (bounding boxes that are very similar)
            is_dup = False
            for bx, by, bx2, by2 in valid_boxes:
                if abs(x - bx) < 20 and abs(y - by) < 20:
                    is_dup = True
                    break
            if not is_dup:
                valid_boxes.append([x, y, x + w, y + h])
                
    print("Found boxes with RETR_TREE:", len(valid_boxes))
    print(valid_boxes)

test()
