from dataclasses import dataclass

@dataclass(frozen=True)
class Scenario:
    name: str
    monthly_price: float
    variable_cost: float
    fixed_cost: float
    cac: float
    monthly_churn: float

    @property
    def contribution(self) -> float:
        return self.monthly_price - self.variable_cost

    @property
    def gross_margin(self) -> float:
        return self.contribution / self.monthly_price

    @property
    def break_even_users(self) -> int:
        return int(self.fixed_cost / self.contribution) + (1 if self.fixed_cost % self.contribution else 0)

    @property
    def contribution_ltv(self) -> float:
        return self.contribution / self.monthly_churn

    @property
    def cac_payback_months(self) -> float:
        return self.cac / self.contribution

scenarios = [
    Scenario("Lean consumer", 999, 250, 350_000, 1_500, 0.08),
    Scenario("Premium consumer", 1_999, 500, 350_000, 2_500, 0.06),
    Scenario("Lean B2B seat", 2_999, 700, 1_000_000, 8_000, 0.035),
]

print("scenario|price|variable_cost|contribution|gross_margin|fixed_cost|break_even_users|CAC|churn|contribution_LTV|CAC_payback_months")
for s in scenarios:
    print(f"{s.name}|{s.monthly_price:.0f}|{s.variable_cost:.0f}|{s.contribution:.0f}|{s.gross_margin:.4f}|{s.fixed_cost:.0f}|{s.break_even_users}|{s.cac:.0f}|{s.monthly_churn:.4f}|{s.contribution_ltv:.0f}|{s.cac_payback_months:.2f}")

for users in (250, 500, 1000, 2000):
    s = scenarios[0]
    monthly_profit = users * s.contribution - s.fixed_cost
    print(f"lean_consumer_users={users}|monthly_operating_surplus={monthly_profit:.0f}")

for users in (100, 250, 500, 1000):
    s = scenarios[1]
    monthly_profit = users * s.contribution - s.fixed_cost
    print(f"premium_consumer_users={users}|monthly_operating_surplus={monthly_profit:.0f}")
