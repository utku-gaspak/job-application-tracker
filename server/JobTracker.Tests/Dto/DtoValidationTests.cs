namespace JobTracker.Tests.Dto;

public class DtoValidationTests
{
    [Theory]
    [InlineData("ab")]
    [InlineData("this-username-is-too-long")]
    public void RegisterDto_InvalidUsername_ShouldFailValidation(string username)
    {
        var dto = CreateValidRegisterDto();
        dto.Username = username;

        var results = Validate(dto);

        results.Should().Contain(result => result.MemberNames.Contains(nameof(RegisterDto.Username)));
    }

    [Fact]
    public void RegisterDto_InvalidEmail_ShouldFailValidation()
    {
        var dto = CreateValidRegisterDto();
        dto.Email = "not-an-email";

        var results = Validate(dto);

        results.Should().Contain(result => result.MemberNames.Contains(nameof(RegisterDto.Email)));
    }

    [Theory]
    [InlineData("short")]
    public void RegisterDto_InvalidPassword_ShouldFailValidation(string password)
    {
        var dto = CreateValidRegisterDto();
        dto.Password = password;

        var results = Validate(dto);

        results.Should().Contain(result => result.MemberNames.Contains(nameof(RegisterDto.Password)));
    }

    [Fact]
    public void RegisterDto_ValidValues_ShouldPassValidation()
    {
        var dto = CreateValidRegisterDto();

        var results = Validate(dto);

        results.Should().BeEmpty();
    }

    private static RegisterDto CreateValidRegisterDto()
    {
        return new RegisterDto
        {
            Username = "utku",
            Email = "utku@example.com",
            Password = "password123",
        };
    }

    private static List<ValidationResult> Validate(object dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }
}
