import { describe, test, expect, beforeEach } from "vitest";
import { autofillFormFields } from "../../extension/autofill_engine.js";

describe("Tayari Extension Autofill Engine DOM Fixture Tests", () => {
  const dummyProfile = {
    firstName: "Alex",
    lastName: "Developer",
    fullName: "Alex Developer",
    email: "alex@example.com",
    phone: "+15550199",
    linkedin: "https://linkedin.com/in/alexdev",
    github: "https://github.com/alexdev",
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("autofills Greenhouse ATS job application form fixture", () => {
    document.body.innerHTML = `
      <form id="application_form">
        <label for="first_name">First Name</label>
        <input type="text" id="first_name" name="first_name" />

        <label for="last_name">Last Name</label>
        <input type="text" id="last_name" name="last_name" />

        <label for="email">Email</label>
        <input type="email" id="email" name="email" />

        <label for="phone">Phone</label>
        <input type="tel" id="phone" name="phone" />

        <label for="job_application_answers_attributes_0_value">LinkedIn Profile</label>
        <input type="text" id="job_application_answers_attributes_0_value" name="linkedin_url" />
      </form>
    `;

    const result = autofillFormFields(dummyProfile);
    expect(result.filledCount).toBeGreaterThanOrEqual(4);

    const firstNameInput = document.getElementById("first_name") as HTMLInputElement;
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const linkedinInput = document.getElementById("job_application_answers_attributes_0_value") as HTMLInputElement;

    expect(firstNameInput.value).toBe("Alex");
    expect(emailInput.value).toBe("alex@example.com");
    expect(linkedinInput.value).toBe("https://linkedin.com/in/alexdev");
  });

  test("autofills Lever ATS job application form fixture", () => {
    document.body.innerHTML = `
      <div className="application-form">
        <input type="text" name="name" placeholder="Full name" />
        <input type="email" name="email" placeholder="Email address" />
        <input type="text" name="phone" placeholder="Phone number" />
        <input type="text" name="urls[LinkedIn]" placeholder="LinkedIn URL" />
        <input type="text" name="urls[GitHub]" placeholder="GitHub URL" />
      </div>
    `;

    const result = autofillFormFields(dummyProfile);
    expect(result.filledCount).toBeGreaterThanOrEqual(4);

    const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;

    expect(nameInput.value).toBe("Alex Developer");
    expect(emailInput.value).toBe("alex@example.com");
  });

  test("autofills Workday / Ashby generic form fields", () => {
    document.body.innerHTML = `
      <div>
        <label>Given-Name <input type="text" id="given-name" /></label>
        <label>Family-Name <input type="text" id="family-name" /></label>
        <label>Electronic Mail <input type="text" id="electronic_mail" /></label>
      </div>
    `;

    const result = autofillFormFields(dummyProfile);
    expect(result.filledCount).toBe(3);

    const givenNameInput = document.getElementById("given-name") as HTMLInputElement;
    const emailInput = document.getElementById("electronic_mail") as HTMLInputElement;

    expect(givenNameInput.value).toBe("Alex");
    expect(emailInput.value).toBe("alex@example.com");
  });
});
