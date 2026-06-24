import numpy as np
from typing import List, Dict, Any

class BanditService:
    @staticmethod
    def select_variant(variants: List[Dict[str, Any]]) -> int:
        """
        Applies Thompson Sampling to select the best resume variant.
        Each dictionary in `variants` must contain:
        - 'variant_id': int
        - 'pulls': int
        - 'conversions': int
        """
        if not variants:
            raise ValueError("No variants provided for Thompson Sampling.")

        best_score = -1.0
        selected_id = variants[0]["variant_id"]

        for v in variants:
            alpha = v.get("conversions", 0)
            beta = v.get("pulls", 0) - alpha
            
            # Bound parameters to be positive
            alpha_param = max(alpha, 0) + 1.0
            beta_param = max(beta, 0) + 1.0

            # Sample from Beta distribution
            sampled_rate = np.random.beta(alpha_param, beta_param)
            
            if sampled_rate > best_score:
                best_score = sampled_rate
                selected_id = v["variant_id"]

        return selected_id
