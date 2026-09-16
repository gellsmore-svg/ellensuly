from app.models.assessment import (
    derived_overall_impact,
    exposure_score,
    uncertainty_from_confidence,
)


def test_exposure_score_is_product_and_not_ratio_language():
    result = exposure_score(4, 5)
    assert result.score == 20
    assert result.band == "extreme"
    assert "not scientifically twice" in result.caveat.lower() or "not scientifically" in result.caveat


def test_unassessed_exposure_has_no_score():
    result = exposure_score(None, 4)
    assert result.score is None
    assert result.band is None


def test_uncertainty_is_explicit_inverse_of_confidence():
    assert uncertainty_from_confidence(1) == 5
    assert uncertainty_from_confidence(5) == 1
    assert uncertainty_from_confidence(3) == 3
    assert uncertainty_from_confidence(None) is None


def test_overall_impact_uses_max_not_average():
    # Safety 5 and financial 1 must not become 3.
    assert derived_overall_impact({"safety": 5, "financial": 1}) == 5
    assert derived_overall_impact({}) is None
