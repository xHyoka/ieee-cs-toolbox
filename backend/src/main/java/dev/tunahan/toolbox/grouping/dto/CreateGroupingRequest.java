package dev.tunahan.toolbox.grouping.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateGroupingRequest(
        @Size(max = 100, message = "Etkinlik adı en fazla 100 karakter olabilir")
        String title,

        @NotNull(message = "İsim listesi gönderilmeli")
        List<String> names,

        @NotNull(message = "Grup boyutu seçilmeli")
        @Min(value = 2, message = "Grup boyutu en az 2 olmalı")
        @Max(value = 5, message = "Grup boyutu en fazla 5 olabilir")
        Integer groupSize,

        Boolean preventRepeats
) {
}