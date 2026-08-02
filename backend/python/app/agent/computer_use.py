from typing import Dict, Any, Tuple, List

class ComputerUseDriver:
    """
    Computer Use & Spatial Vision Driver.
    Implements Anthropic Computer Use vision reasoning: maps pixel coordinates,
    calculates element bounding boxes from OS/browser screenshots, and formats input commands.
    """

    def __init__(self, screen_width: int = 1280, screen_height: int = 800):
        self.width = screen_width
        self.height = screen_height

    def calculate_center_coordinates(self, bbox: Tuple[int, int, int, int]) -> Tuple[int, int]:
        """
        Calculate target center (x, y) coordinates from bounding box (x_min, y_min, x_max, y_max).
        """
        x_min, y_min, x_max, y_max = bbox
        center_x = int((x_min + x_max) / 2)
        center_y = int((y_min + y_max) / 2)
        return center_x, center_y

    def format_mouse_click(self, x: int, y: int, button: str = "left") -> Dict[str, Any]:
        """Format computer use mouse click command."""
        clamped_x = max(0, min(x, self.width - 1))
        clamped_y = max(0, min(y, self.height - 1))
        return {
            "action": "mouse_move_click",
            "coordinate": [clamped_x, clamped_y],
            "button": button
        }

    def format_key_press(self, keys: List[str]) -> Dict[str, Any]:
        """Format computer use keyboard event sequence."""
        return {
            "action": "key_press",
            "keys": keys
        }
