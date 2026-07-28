import cv2
import numpy as np
import base64
import os

width, height = 1280, 720
fps = 30.0

# Try avc1
try:
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    filepath = "test_avc1.mp4"
    out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    canvas[:] = (0, 0, 255)
    for _ in range(30):
        out.write(canvas)
    out.release()
    print("avc1 test passed.")
except Exception as e:
    print("avc1 test failed:", e)

# Try vp80
try:
    fourcc = cv2.VideoWriter_fourcc(*'vp80')
    filepath = "test_vp80.webm"
    out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    canvas[:] = (0, 255, 0)
    for _ in range(30):
        out.write(canvas)
    out.release()
    print("vp80 test passed.")
except Exception as e:
    print("vp80 test failed:", e)
