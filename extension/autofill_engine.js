/**
 * Tayari Smart ATS Form Autofill Engine
 * Supports Greenhouse, Lever, Ashby, Workday, and generic application portals.
 */

const TAYARI_AUTOFILL_RULES = {
  first_name: ["first_name", "firstname", "given-name", "first name"],
  last_name: ["last_name", "lastname", "family-name", "last name"],
  full_name: ["name", "full_name", "fullname", "candidate_name"],
  email: ["email", "email_address", "electronic_mail"],
  phone: ["phone", "telephone", "phone_number", "mobile"],
  linkedin: ["linkedin", "linkedin_url", "linkedin_profile"],
  github: ["github", "github_url", "portfolio_url"],
  location: ["location", "city", "address", "current_location"],
  salary: ["salary", "expected_salary", "compensation", "desired_salary"],
};

export function autofillFormFields(profile) {
  if (!profile) return { filledCount: 0 };

  let filledCount = 0;
  const inputs = document.querySelectorAll("input, textarea, select");

  inputs.forEach((input) => {
    const nameAttr = (input.getAttribute("name") || "").toLowerCase();
    const idAttr = (input.getAttribute("id") || "").toLowerCase();
    const labelText = getAssociatedLabelText(input).toLowerCase();

    const combinedStr = `${nameAttr} ${idAttr} ${labelText}`;

    // Fill First Name
    if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.first_name)) {
      setInputValue(input, profile.firstName || profile.fullName?.split(" ")[0] || "");
      filledCount++;
    }
    // Fill Last Name
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.last_name)) {
      setInputValue(input, profile.lastName || profile.fullName?.split(" ").slice(1).join(" ") || "");
      filledCount++;
    }
    // Fill Full Name
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.full_name)) {
      setInputValue(input, profile.fullName || "");
      filledCount++;
    }
    // Fill Email
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.email)) {
      setInputValue(input, profile.email || "");
      filledCount++;
    }
    // Fill Phone
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.phone)) {
      setInputValue(input, profile.phone || "");
      filledCount++;
    }
    // Fill LinkedIn
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.linkedin)) {
      setInputValue(input, profile.linkedin || "");
      filledCount++;
    }
    // Fill GitHub / Website
    else if (matchesRule(combinedStr, TAYARI_AUTOFILL_RULES.github)) {
      setInputValue(input, profile.github || profile.website || "");
      filledCount++;
    }
  });

  return { filledCount };
}

function matchesRule(str, keywords) {
  return keywords.some((kw) => str.includes(kw));
}

function getAssociatedLabelText(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText;
  }
  const parentLabel = input.closest("label");
  if (parentLabel) return parentLabel.innerText;
  return "";
}

function setInputValue(input, value) {
  if (!value) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
